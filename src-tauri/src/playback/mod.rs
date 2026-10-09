//! Cancels the active resolver future by dropping it; no token URL storage/logging.
use std::{future::{poll_fn, Future}, pin::pin, sync::Mutex, task::Poll};
use tokio::sync::oneshot;
use crate::radio::{self, AppError, ErrorCode, ResolvedStream};

#[derive(Default)]
pub struct Resolver { active: Mutex<Option<oneshot::Sender<()>>> }
impl Resolver {
    pub fn cancel(&self) {
        if let Some(sender) = self.active.lock().unwrap_or_else(|e| e.into_inner()).take() {
            let _ = sender.send(());
        }
    }
    async fn run<F: Future>(&self, future: F) -> Option<F::Output> {
        let (sender, receiver) = oneshot::channel();
        if let Some(previous) = self.active.lock().unwrap_or_else(|e| e.into_inner()).replace(sender) {
            let _ = previous.send(());
        }
        let mut cancellation = pin!(receiver);
        let mut work = pin!(future);
        poll_fn(|cx| {
            if cancellation.as_mut().poll(cx).is_ready() { return Poll::Ready(None); }
            work.as_mut().poll(cx).map(Some)
        }).await
        // Both futures are dropped here, terminating pending reqwest work on cancellation.
    }
    pub async fn resolve(&self, station_id: &str) -> Result<ResolvedStream, AppError> {
        self.run(radio::resolve_stream(station_id)).await.unwrap_or_else(|| {
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
        let mut work=Box::pin(resolver.run(PendingDrop(dropped.clone())));
        let mut context=Context::from_waker(Waker::noop());
        assert!(work.as_mut().poll(&mut context).is_pending());resolver.cancel();
        assert_eq!(work.as_mut().poll(&mut context),Poll::Ready(None));
        assert!(dropped.load(Ordering::SeqCst));
    }
    #[test]
    fn new_request_cancels_previous() {
        let resolver=Resolver::default();let mut first=Box::pin(resolver.run(pending::<()>()));
        let mut context=Context::from_waker(Waker::noop());assert!(first.as_mut().poll(&mut context).is_pending());
        let mut second=Box::pin(resolver.run(async {42}));assert_eq!(second.as_mut().poll(&mut context),Poll::Ready(Some(42)));
        assert_eq!(first.as_mut().poll(&mut context),Poll::Ready(None));
    }
}
