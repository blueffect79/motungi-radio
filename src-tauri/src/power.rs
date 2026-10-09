//! Native system wake notifications. Window focus and event-loop start are not power events.
use tauri::Emitter;

fn resumed(app: &tauri::AppHandle) {
    let _ = app.emit("system-resumed", ());
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("system-power")
        .setup(|app, _| platform::register(app.clone()))
        .on_event(|_, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                platform::unregister();
            }
        })
        .build()
}

#[cfg(target_os = "macos")]
mod platform {
    use block2::RcBlock;
    use objc2::{rc::Retained, runtime::ProtocolObject};
    use objc2_app_kit::{NSWorkspace, NSWorkspaceDidWakeNotification};
    use objc2_foundation::{NSNotification, NSNotificationCenter, NSObjectProtocol};
    use std::{cell::RefCell, ptr::NonNull};

    struct Observer {
        center: Retained<NSNotificationCenter>,
        token: Retained<ProtocolObject<dyn NSObjectProtocol>>,
    }
    impl Drop for Observer {
        fn drop(&mut self) {
            // The token belongs to this center and stays retained until removal completes.
            unsafe { self.center.removeObserver((*self.token).as_ref()) }
        }
    }
    thread_local! { static OBSERVER: RefCell<Option<Observer>> = const { RefCell::new(None) }; }

    pub fn register(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        // Tauri plugin setup and Exit run on the main thread. NSWorkspace has its OWN center.
        // https://developer.apple.com/documentation/appkit/nsworkspace/didwakenotification
        let center = NSWorkspace::sharedWorkspace().notificationCenter();
        let block = RcBlock::new(move |_: NonNull<NSNotification>| super::resumed(&app));
        // No object filter/queue; closure captures only a thread-safe AppHandle.
        let token = unsafe {
            center.addObserverForName_object_queue_usingBlock(
                Some(NSWorkspaceDidWakeNotification),
                None,
                None,
                &block,
            )
        };
        OBSERVER.with(|slot| *slot.borrow_mut() = Some(Observer { center, token }));
        Ok(())
    }
    pub fn unregister() {
        OBSERVER.with(|slot| slot.borrow_mut().take());
    }
}

#[cfg(target_os = "windows")]
mod platform {
    use std::{
        ffi::c_void,
        sync::{
            atomic::{AtomicUsize, Ordering},
            OnceLock,
        },
    };
    // Windows 8+ powerbase.h / Powrprof.lib, independent of window visibility.
    // https://learn.microsoft.com/windows/win32/api/powerbase/nf-powerbase-powerregistersuspendresumenotification
    #[repr(C)]
    struct SubscribeParameters {
        callback: unsafe extern "system" fn(*mut c_void, u32, *mut c_void) -> u32,
        context: *mut c_void,
    }
    // Immutable callback descriptor remains alive for the full registration lifetime.
    unsafe impl Sync for SubscribeParameters {}
    static PARAMETERS: SubscribeParameters = SubscribeParameters {
        callback,
        context: std::ptr::null_mut(),
    };
    #[link(name = "Powrprof")]
    extern "system" {
        fn PowerRegisterSuspendResumeNotification(
            flags: u32,
            recipient: *mut c_void,
            handle: *mut *mut c_void,
        ) -> u32;
        fn PowerUnregisterSuspendResumeNotification(handle: *mut c_void) -> u32;
    }
    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();
    static HANDLE: AtomicUsize = AtomicUsize::new(0);
    unsafe extern "system" fn callback(_: *mut c_void, kind: u32, _: *mut c_void) -> u32 {
        // Automatic resume is sent for EVERY wake; ignoring RESUMESUSPEND avoids duplicate reconnect.
        // No borrowed callback context: APP remains valid even during unregister/exit races.
        if kind == 0x12 {
            if let Some(app) = APP.get() {
                super::resumed(app);
            }
        }
        0
    }
    pub fn register(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        let _ = APP.set(app);
        let mut handle = std::ptr::null_mut();
        let error = unsafe {
            PowerRegisterSuspendResumeNotification(
                2,
                (&PARAMETERS as *const SubscribeParameters)
                    .cast_mut()
                    .cast(),
                &mut handle,
            )
        };
        if error != 0 {
            return Err(std::io::Error::from_raw_os_error(error as i32).into());
        }
        HANDLE.store(handle as usize, Ordering::Release);
        Ok(())
    }
    pub fn unregister() {
        let handle = HANDLE.swap(0, Ordering::AcqRel);
        if handle != 0 {
            unsafe {
                PowerUnregisterSuspendResumeNotification(handle as *mut c_void);
            }
        }
    }
}
