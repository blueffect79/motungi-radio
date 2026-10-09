use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition, WindowEvent,
};
#[derive(Default)]
struct PlayerWindowState {
    pinned: AtomicBool,
}

fn hide_on_blur(pinned: bool) -> bool {
    !pinned && !cfg!(target_os = "linux")
}

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
fn contains_point(bounds: (i32, i32, u32, u32), point: (i32, i32)) -> bool {
    let (x, y, w, h) = bounds;
    let (px, py) = point;
    px as i64 >= x as i64
        && py as i64 >= y as i64
        && (px as i64) < x as i64 + w as i64
        && (py as i64) < y as i64 + h as i64
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
pub fn show(app: &tauri::AppHandle, rect: Option<tauri::Rect>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Some(rect) = rect.filter(|_| {
            !app.try_state::<PlayerWindowState>()
                .is_some_and(|s| s.pinned.load(Ordering::SeqCst))
        }) {
            let point = rect.position.to_physical::<i32>(1.0);
            // macOS monitor_from_point forwards to CoreGraphics logical coordinates,
            // while tray rectangles are physical pixels. Compare physical bounds directly.
            if let Some(monitor) = window.available_monitors().ok().and_then(|monitors| {
                monitors.into_iter().find(|m| {
                    let pos = m.position();
                    let size = m.size();
                    contains_point((pos.x, pos.y, size.width, size.height), (point.x, point.y))
                })
            }) {
                // Tray rectangles already use physical pixels; applying monitor scaling twice shifts Retina placement.
                let scale = 1.0;
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
        let _ = window.unminimize();
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
    app.manage(PlayerWindowState::default());
    let state = Arc::new(Mutex::new(ToggleState::default()));
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(target_os = "linux")]
        window.set_skip_taskbar(false)?;
        let handle = window.clone();
        let state = state.clone();
        window.on_window_event(move |event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                #[cfg(target_os = "linux")]
                let _ = handle.minimize();
                #[cfg(not(target_os = "linux"))]
                let _ = handle.hide();
            }
            WindowEvent::Focused(false) => {
                if !hide_on_blur(
                    handle
                        .app_handle()
                        .state::<PlayerWindowState>()
                        .pinned
                        .load(Ordering::SeqCst),
                ) {
                    return;
                }
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
    let icon = status_icon(false);
    TrayIconBuilder::with_id("radio")
        .icon(icon)
        .icon_as_template(false)
        .tooltip("모퉁이 라디오")
        .menu(&menu)
        .show_menu_on_left_click(cfg!(target_os = "linux"))
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
    if !crate::desktop::is_autostart(std::env::args()) {
        show(
            app.handle(),
            app.tray_by_id("radio")
                .and_then(|t| t.rect().ok().flatten()),
        );
    }
    Ok(())
}

/// A blue radio glyph plus a separate play/pause badge on every platform.
fn status_pixels(playing: bool) -> Vec<u8> {
    let mut pixels = vec![0u8; 30 * 22 * 4];
    for y in 0usize..22 {
        for x in 0usize..30 {
            let body = (4..=18).contains(&y) && (2..=19).contains(&x);
            let border = body && (x <= 3 || x >= 18 || y <= 5 || y >= 17);
            let speaker = (8..=14).contains(&y) && (5..=10).contains(&x) && ((x + y) % 2 == 0);
            let control = (8..=9).contains(&y) && (13..=16).contains(&x);
            let antenna = y == 2 && (5..=17).contains(&x) || x == 5 && y == 3;
            let badge = if playing {
                (13..=19).contains(&y)
                    && (23..=28).contains(&x)
                    && x - 23 <= 3usize.saturating_sub(y.abs_diff(16))
            } else {
                (13..=19).contains(&y) && ((23..=24).contains(&x) || (27..=28).contains(&x))
            };
            if border || speaker || control || antenna || badge {
                let i = (y * 30 + x) * 4;
                pixels[i..i + 3].copy_from_slice(&[92, 145, 255]);
                pixels[i + 3] = 255;
            }
        }
    }
    pixels
}
fn status_icon(playing: bool) -> tauri::image::Image<'static> {
    tauri::image::Image::new_owned(status_pixels(playing), 30, 22)
}
#[tauri::command]
pub fn set_tray_playing(playing: bool, app: tauri::AppHandle) -> Result<(), String> {
    let tray = app
        .tray_by_id("radio")
        .ok_or("아이콘을 찾을 수 없습니다.")?;
    tray.set_icon(Some(status_icon(playing)))
        .map_err(|_| "아이콘을 변경할 수 없습니다.")?;
    tray.set_tooltip(Some(if playing {
        "모퉁이 라디오 · 재생 중"
    } else {
        "모퉁이 라디오 · 일시정지"
    }))
    .map_err(|_| "아이콘 상태를 변경할 수 없습니다.".to_string())
}
#[tauri::command]
pub fn set_player_pinned(pinned: bool, app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("창을 찾을 수 없습니다.")?;
    window
        .set_always_on_top(pinned)
        .map_err(|_| "플레이어 고정을 변경할 수 없습니다.")?;
    app.state::<PlayerWindowState>()
        .pinned
        .store(pinned, Ordering::SeqCst);
    if !pinned {
        show(
            &app,
            app.tray_by_id("radio")
                .and_then(|t| t.rect().ok().flatten()),
        );
    }
    Ok(())
}
#[tauri::command]
pub fn start_player_drag(app: tauri::AppHandle) -> Result<(), String> {
    if !app
        .state::<PlayerWindowState>()
        .pinned
        .load(Ordering::SeqCst)
    {
        return Err("고정된 플레이어만 이동할 수 있습니다.".into());
    }
    app.get_webview_window("main")
        .ok_or("창을 찾을 수 없습니다.")?
        .start_dragging()
        .map_err(|_| "창을 이동할 수 없습니다.".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pinned_window_keeps_visibility_and_status_badge_changes() {
        assert!(!hide_on_blur(true));
        assert_eq!(hide_on_blur(false), !cfg!(target_os = "linux"));
        let playing = status_pixels(true);
        let stopped = status_pixels(false);
        assert_ne!(playing, stopped);
        assert_eq!(&playing[..22 * 4], &stopped[..22 * 4]);
    }
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
    fn retina_tray_point_matches_physical_monitor_bounds() {
        assert!(contains_point((0, 0, 3360, 2100), (3000, 0)));
        assert!(!contains_point((0, 0, 1680, 1050), (3000, 0)));
        assert!(contains_point((-2880, 0, 2880, 1800), (-200, 0)));
        assert!(!contains_point((-2880, 0, 2880, 1800), (0, 0)));
        assert_eq!(
            clamped_position((3000, 0, 60, 50), (0, 50, 3360, 2050), (760, 1280), true),
            (2600, 56)
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
pub fn set_player_size(
    mini: bool,
    height: Option<u32>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("창을 찾을 수 없습니다.")?;
    window
        .set_size(tauri::LogicalSize::new(
            380.0,
            if mini {
                height.unwrap_or(240).clamp(200, 360) as f64
            } else {
                640.0
            },
        ))
        .map_err(|_| "창 크기를 변경할 수 없습니다.")?;
    if !app
        .state::<PlayerWindowState>()
        .pinned
        .load(Ordering::SeqCst)
    {
        if window.is_visible().unwrap_or(false) {
            show(
                &app,
                app.tray_by_id("radio")
                    .and_then(|t| t.rect().ok().flatten()),
            );
        }
    }
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
