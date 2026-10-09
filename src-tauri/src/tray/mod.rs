use std::{
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, WindowEvent,
};
#[derive(Default)]
struct ToggleState {
    blurred: Option<Instant>,
    clicked: Option<Instant>,
}
fn toggle(state: &mut ToggleState, visible: bool, now: Instant) -> Option<bool> {
    if state
        .clicked
        .is_some_and(|t| now.duration_since(t) < Duration::from_millis(250))
    {
        return None;
    }
    state.clicked = Some(now);
    let just_blurred = state
        .blurred
        .take()
        .is_some_and(|t| now.duration_since(t) < Duration::from_millis(300));
    Some(!visible && !just_blurred)
}
fn clamped_position(
    icon: (i32, i32, u32, u32),
    work: (i32, i32, u32, u32),
    window: (u32, u32),
    below: bool,
) -> (i32, i32) {
    let (x, y, w, h) = icon;
    let (wx, wy, ww, wh) = work;
    let (width, height) = window;
    let px = x + w as i32 / 2 - width as i32 / 2;
    let py = if below {
        y + h as i32 + 6
    } else {
        y - height as i32 - 6
    };
    (
        px.clamp(wx, wx + (ww.saturating_sub(width)) as i32),
        py.clamp(wy, wy + (wh.saturating_sub(height)) as i32),
    )
}
fn show(app: &tauri::AppHandle, rect: Option<tauri::Rect>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(rect) = rect {
            let point = rect.position.to_physical::<i32>(1.0);
            if let Ok(Some(monitor)) = window.monitor_from_point(point.x as f64, point.y as f64) {
                let scale = monitor.scale_factor();
                let pos = rect.position.to_physical::<i32>(scale);
                let size = rect.size.to_physical::<u32>(scale);
                let work = monitor.work_area();
                if let Ok(ws) = window.outer_size() {
                    let (x, y) = clamped_position(
                        (pos.x, pos.y, size.width, size.height),
                        (
                            work.position.x,
                            work.position.y,
                            work.size.width,
                            work.size.height,
                        ),
                        (ws.width, ws.height),
                        cfg!(target_os = "macos"),
                    );
                    let _ = window.set_position(PhysicalPosition::new(x, y));
                }
            }
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}
#[tauri::command]
pub fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}
pub fn setup(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "macos")]
    app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    let state = Arc::new(Mutex::new(ToggleState::default()));
    if let Some(window) = app.get_webview_window("main") {
        let handle = window.clone();
        let state = state.clone();
        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = handle.hide();
            }
            WindowEvent::Focused(false) => {
                if let Ok(mut state) = state.lock() {
                    state.blurred = Some(Instant::now());
                }
                let _ = handle.hide();
            }
            _ => {}
        });
    }
    let open = MenuItem::with_id(app, "open", "열기", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;
    // Transparent monochrome glyph supports macOS template tinting.
    let mut pixels = vec![0u8; 22 * 22 * 4];
    for y in 0usize..22 {
        for x in 0usize..22 {
            let body = (4..=18).contains(&y) && (2..=19).contains(&x);
            let border = body && (x <= 3 || x >= 18 || y <= 5 || y >= 17);
            let speaker = (8..=14).contains(&y) && (5..=10).contains(&x) && ((x + y) % 2 == 0);
            let controls = (8..=9).contains(&y) && (13..=16).contains(&x)
                || (12..=14).contains(&y) && (13..=15).contains(&x);
            let antenna = y == 2 && (5..=17).contains(&x) || x == 5 && y == 3;
            if border || speaker || controls || antenna {
                pixels[(y * 22 + x) * 4 + 3] = 255;
            }
        }
    }
    let icon = if cfg!(target_os = "macos") {
        tauri::image::Image::new_owned(pixels, 22, 22)
    } else {
        app.default_window_icon()
            .ok_or("앱 아이콘을 찾을 수 없습니다")?
            .clone()
    };
    TrayIconBuilder::with_id("radio")
        .icon(icon)
        .icon_as_template(cfg!(target_os = "macos"))
        .tooltip("한국 라디오")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show(
                app,
                app.tray_by_id("radio")
                    .and_then(|t| t.rect().ok().flatten()),
            ),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(move |tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let Ok(mut state) = state.lock() else { return };
                    let decision = toggle(
                        &mut state,
                        window.is_visible().unwrap_or(false),
                        Instant::now(),
                    );
                    drop(state);
                    match decision {
                        Some(true) => show(app, Some(rect)),
                        Some(false) => {
                            let _ = window.hide();
                        }
                        None => {}
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn blur_before_tray_click_does_not_reopen() {
        let now = Instant::now();
        let mut s = ToggleState {
            blurred: Some(now - Duration::from_millis(50)),
            clicked: None,
        };
        assert_eq!(toggle(&mut s, false, now), Some(false));
        assert_eq!(
            toggle(&mut s, false, now + Duration::from_millis(100)),
            None
        );
        assert_eq!(
            toggle(&mut s, false, now + Duration::from_secs(1)),
            Some(true)
        );
    }
    #[test]
    fn visible_click_hides_and_hidden_click_opens() {
        let now = Instant::now();
        let mut s = ToggleState::default();
        assert_eq!(toggle(&mut s, true, now), Some(false));
        assert_eq!(
            toggle(&mut s, false, now + Duration::from_secs(1)),
            Some(true)
        );
    }
    #[test]
    fn mac_places_below_and_clamps_right() {
        assert_eq!(
            clamped_position((1400, 0, 24, 24), (0, 24, 1440, 876), (380, 640), true),
            (1060, 30)
        );
    }
    #[test]
    fn windows_places_above_bottom_tray() {
        assert_eq!(
            clamped_position((1800, 1040, 24, 40), (0, 0, 1920, 1040), (380, 640), false),
            (1540, 394)
        );
    }
    #[test]
    fn negative_monitor_and_small_work_area() {
        assert_eq!(
            clamped_position((-1900, 0, 24, 24), (-1920, 24, 300, 400), (380, 640), true),
            (-1920, 24)
        );
    }
}

/// Resize the existing webview, preserving the one audio controller.
#[tauri::command]
pub fn set_player_size(mini: bool, app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("창을 찾을 수 없습니다.")?;
    window
        .set_size(tauri::LogicalSize::new(
            380.0,
            if mini { 270.0 } else { 640.0 },
        ))
        .map_err(|_| "창 크기를 변경할 수 없습니다.")?;
    if let (Ok(Some(monitor)), Ok(pos), Ok(size)) = (
        window.current_monitor(),
        window.outer_position(),
        window.outer_size(),
    ) {
        let area = monitor.work_area();
        let x = pos.x.clamp(
            area.position.x,
            area.position.x + area.size.width.saturating_sub(size.width) as i32,
        );
        let y = pos.y.clamp(
            area.position.y,
            area.position.y + area.size.height.saturating_sub(size.height) as i32,
        );
        window
            .set_position(PhysicalPosition::new(x, y))
            .map_err(|_| "창 위치를 변경할 수 없습니다.")?;
    }
    Ok(())
}
/// The frontend supplies only a station ID; no arbitrary URL or shell text is accepted.
#[tauri::command]
pub fn open_station_page(station_id: String) -> Result<(), String> {
    let catalog = crate::radio::list_stations().map_err(|_| "방송 목록을 확인할 수 없습니다.")?;
    let station = catalog
        .stations
        .into_iter()
        .find(|s| s.id == station_id)
        .ok_or("등록되지 않은 방송입니다.")?;
    let url = station.official_page_url;
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(&url).spawn();
    result
        .map(|_| ())
        .map_err(|_| "공식 페이지를 열 수 없습니다.".into())
}
