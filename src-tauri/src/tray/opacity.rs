use tauri::WebviewWindow;

// Called on the UI thread. Keep the entire window visible and interactive.
pub fn apply(window: &WebviewWindow, percent: u8) -> Result<(), String> {
    let alpha = f64::from(percent) / 100.0;
    #[cfg(target_os = "macos")]
    {
        let raw = window.ns_window().map_err(|e| e.to_string())?;
        let native = raw.cast::<objc2::runtime::AnyObject>();
        unsafe {
            let _: () = objc2::msg_send![native, setAlphaValue: alpha];
        }
    }
    #[cfg(target_os = "windows")]
    {
        use std::ffi::c_void;
        #[link(name = "user32")]
        extern "system" {
            fn GetWindowLongW(hwnd: *mut c_void, index: i32) -> i32;
            fn SetWindowLongW(hwnd: *mut c_void, index: i32, value: i32) -> i32;
            fn SetLayeredWindowAttributes(
                hwnd: *mut c_void,
                color: u32,
                alpha: u8,
                flags: u32,
            ) -> i32;
        }
        #[link(name = "kernel32")]
        extern "system" {
            fn SetLastError(code: u32);
            fn GetLastError() -> u32;
        }
        let hwnd = window.hwnd().map_err(|e| e.to_string())?.0 as *mut c_void;
        unsafe {
            let style = GetWindowLongW(hwnd, -20);
            SetLastError(0);
            if SetWindowLongW(hwnd, -20, style | 0x80000) == 0 && GetLastError() != 0 {
                return Err("창 투명도를 변경할 수 없습니다.".into());
            }
            if SetLayeredWindowAttributes(hwnd, 0, (alpha * 255.0).round() as u8, 2) == 0 {
                return Err("창 투명도를 변경할 수 없습니다.".into());
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::WidgetExt;
        window
            .gtk_window()
            .map_err(|e| e.to_string())?
            .set_opacity(alpha);
    }
    Ok(())
}
