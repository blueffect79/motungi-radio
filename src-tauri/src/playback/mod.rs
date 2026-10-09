//! Cancels the active resolver future by dropping it; no token URL storage/logging.
use std::{future::{poll_fn, Future}, pin::pin, sync::Mutex, task::Poll};
use tokio::sync::oneshot;
use crate::radio::{self, AppError, ErrorCode, ResolvedStream};

#[derive(Default)]
struct Requests {
    // Highest observed start/cancel is a bounded tombstone: older IDs never revive.
    latest_id: u64,
    active: Option<(u64, oneshot::Sender<()>)>,
}
#[derive(Default)]
pub struct Resolver { requests: Mutex<Requests> }
impl Resolver {
    pub fn cancel(&self, request_id: u64) {
        let mut requests = self.requests.lock().unwrap_or_else(|e| e.into_inner());
        requests.latest_id = requests.latest_id.max(request_id);
        if requests.active.as_ref().is_some_and(|(id, _)| *id == request_id) {
            if let Some((_, sender)) = requests.active.take() { let _ = sender.send(()); }
        }
    }
    async fn run<F: Future>(&self, request_id: u64, future: F) -> Option<F::Output> {
        let (sender, receiver) = oneshot::channel();
        {
            let mut requests = self.requests.lock().unwrap_or_else(|e| e.into_inner());
            if request_id <= requests.latest_id { return None; }
            requests.latest_id = request_id;
            if let Some((_, previous)) = requests.active.replace((request_id, sender)) {
                let _ = previous.send(());
            }
        }
        let mut cancellation = pin!(receiver);
        let mut work = pin!(future);
        poll_fn(|cx| {
            if cancellation.as_mut().poll(cx).is_ready() { return Poll::Ready(None); }
            work.as_mut().poll(cx).map(Some)
        }).await
        // Both futures are dropped here, terminating pending reqwest work on cancellation.
    }
    pub async fn resolve(&self, station_id: &str, request_id: u64) -> Result<ResolvedStream, AppError> {
        self.run(request_id, radio::resolve_stream(station_id)).await.unwrap_or_else(|| {
            Err(AppError::new(ErrorCode::Unavailable, "방송 연결 요청이 취소되었습니다.", false))
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{future::pending, task::{Context, Waker}, sync::{Arc, atomic::{AtomicBool, Ordering}}};
    struct PendingDrop(Arc<AtomicBool>);
    impl Future for PendingDrop { type Output=(); fn poll(self:std::pin::Pin<&mut Self>,_:&mut Context<'_>)->Poll<()> {Poll::Pending} }
    impl Drop for PendingDrop {fn drop(&mut self){self.0.store(true,Ordering::SeqCst);}}
    #[test]
    fn stop_drops_inflight_work() {
        let resolver=Resolver::default();let dropped=Arc::new(AtomicBool::new(false));
        let mut work=Box::pin(resolver.run(1, PendingDrop(dropped.clone())));
        let mut context=Context::from_waker(Waker::noop());
        assert!(work.as_mut().poll(&mut context).is_pending());resolver.cancel(1);
        assert_eq!(work.as_mut().poll(&mut context),Poll::Ready(None));
        assert!(dropped.load(Ordering::SeqCst));
    }
    #[test]
    fn new_request_cancels_previous() {
        let resolver=Resolver::default();let mut first=Box::pin(resolver.run(1, pending::<()>()));
        let mut context=Context::from_waker(Waker::noop());assert!(first.as_mut().poll(&mut context).is_pending());
        let mut second=Box::pin(resolver.run(2, async {42}));assert_eq!(second.as_mut().poll(&mut context),Poll::Ready(Some(42)));
        assert_eq!(first.as_mut().poll(&mut context),Poll::Ready(None));
    }
    #[test]
    fn late_old_cancel_does_not_cancel_latest() {
        let resolver=Resolver::default();let mut cx=Context::from_waker(Waker::noop());
        let mut current=Box::pin(resolver.run(2, pending::<()>()));
        assert!(current.as_mut().poll(&mut cx).is_pending());resolver.cancel(1);
        assert!(current.as_mut().poll(&mut cx).is_pending());resolver.cancel(2);
        assert_eq!(current.as_mut().poll(&mut cx),Poll::Ready(None));
    }
    #[test]
    fn stop_before_start_leaves_tombstone() {
        let resolver=Resolver::default();resolver.cancel(3);
        let mut cx=Context::from_waker(Waker::noop());let mut cancelled=Box::pin(resolver.run(3, async {42}));
        assert_eq!(cancelled.as_mut().poll(&mut cx),Poll::Ready(None));
        let mut latest=Box::pin(resolver.run(4, async {43}));
        assert_eq!(latest.as_mut().poll(&mut cx),Poll::Ready(Some(43)));
    }
    #[test]
    fn stale_old_start_cannot_replace_latest() {
        let resolver=Resolver::default();let mut cx=Context::from_waker(Waker::noop());
        let mut latest=Box::pin(resolver.run(5, pending::<()>()));assert!(latest.as_mut().poll(&mut cx).is_pending());
        let mut stale=Box::pin(resolver.run(4, async {42}));assert_eq!(stale.as_mut().poll(&mut cx),Poll::Ready(None));
        assert!(latest.as_mut().poll(&mut cx).is_pending());
    }

}
