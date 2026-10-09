#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::Cell;
    struct Mock {
        enabled: Cell<bool>,
        fail: bool,
    }
    impl Registration for Mock {
        fn enabled(&self) -> Result<bool, ()> {
            Ok(self.enabled.get())
        }
        fn set(&self, v: bool) -> Result<(), ()> {
            if self.fail {
                Err(())
            } else {
                self.enabled.set(v);
                Ok(())
            }
        }
    }
    #[test]
    fn registration_failure_and_external_change() {
        let os = Mock {
            enabled: Cell::new(false),
            fail: true,
        };
        assert!(change(&os, true).is_err());
        assert!(!query(&os).unwrap().enabled);
        os.enabled.set(true);
        assert!(query(&os).unwrap().enabled)
    }
    #[test]
    fn launch_is_explicit() {
        assert!(is_autostart(["app", "--autostart"]));
        assert!(!is_autostart(["app"]))
    }
}
use crate::radio::{ApiResult, AppError, ErrorCode};
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;
#[derive(Debug, Serialize)]
pub struct AutostartState {
    pub enabled: bool,
}
trait Registration {
    fn enabled(&self) -> Result<bool, ()>;
    fn set(&self, enabled: bool) -> Result<(), ()>;
}
struct OsRegistration<'a>(&'a tauri::AppHandle);
impl Registration for OsRegistration<'_> {
    fn enabled(&self) -> Result<bool, ()> {
        self.0.autolaunch().is_enabled().map_err(|_| ())
    }
    fn set(&self, enabled: bool) -> Result<(), ()> {
        let manager = self.0.autolaunch();
        if enabled {
            manager.enable()
        } else {
            manager.disable()
        }
        .map_err(|_| ())
    }
}
fn error() -> AppError {
    AppError::new(
        ErrorCode::OsRegistration,
        "로그인 시 실행 설정을 변경하거나 확인할 수 없습니다.",
        true,
    )
}
fn query(os: &impl Registration) -> Result<AutostartState, AppError> {
    Ok(AutostartState {
        enabled: os.enabled().map_err(|_| error())?,
    })
}
fn change(os: &impl Registration, enabled: bool) -> Result<AutostartState, AppError> {
    os.set(enabled).map_err(|_| error())?;
    let actual = query(os)?;
    if actual.enabled != enabled {
        return Err(error());
    }
    Ok(actual)
}
#[tauri::command]
pub fn get_autostart(app: tauri::AppHandle) -> ApiResult<AutostartState> {
    query(&OsRegistration(&app)).into()
}
#[tauri::command]
pub fn set_autostart(app: tauri::AppHandle, enabled: bool) -> ApiResult<AutostartState> {
    change(&OsRegistration(&app), enabled).into()
}
pub fn is_autostart<I, S>(args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    args.into_iter().any(|arg| arg.as_ref() == "--autostart")
}
/// Call before other plugins. A duplicate launch never creates another player or writer.
pub fn plugins(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if !is_autostart(args) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
}
/// Set tauri.conf.json windows.visible=false to avoid an autostart window flash.
/// Normal launch shows the window; autostart only installs tray via the caller's setup.
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let path = app.path().app_config_dir()?.join("settings.json");
    app.manage(crate::settings::SettingsStore::new(path));
    if !is_autostart(std::env::args()) {
        if let Some(window) = app.get_webview_window("main") {
            window.show()?;
        }
    }
    Ok(())
}
