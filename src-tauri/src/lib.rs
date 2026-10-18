#[cfg(all(feature = "app-store", not(target_os = "macos")))]
compile_error!("app-store distribution requires macOS");
#[cfg(all(feature = "microsoft-store", not(target_os = "windows")))]
compile_error!("microsoft-store distribution requires Windows");
use tauri::Manager;

pub mod desktop;
pub mod playback;
mod power;
pub mod programs;
pub mod radio;
pub mod settings;
pub mod tray;
#[cfg(any(all(feature = "direct", feature = "app-store"), all(feature = "direct", feature = "microsoft-store"), all(feature = "app-store", feature = "microsoft-store")))]
compile_error!("Choose exactly one distribution: direct, app-store or microsoft-store");
#[cfg(not(any(feature = "direct", feature = "app-store", feature = "microsoft-store")))]
compile_error!("Choose a distribution feature");
#[cfg(feature = "direct")]
mod updates;
#[tauri::command]
fn open_about_page(page: String) -> Result<(), String> {
    let url = match page.as_str() {
        "website" => "https://devsejong.github.io/motungi-radio/",
        "github" => "https://github.com/devsejong/motungi-radio",
        "license" => "https://github.com/devsejong/motungi-radio/blob/main/LICENSE",
        "privacy" => "https://devsejong.github.io/motungi-radio/privacy.html",
        _ => return Err("등록되지 않은 페이지입니다.".into()),
    };
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("rundll32.exe")
        .args(["url.dll,FileProtocolHandler", url])
        .spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let result = std::process::Command::new("xdg-open").arg(url).spawn();
    result
        .map(|_| ())
        .map_err(|_| "페이지를 열 수 없습니다.".into())
}

#[tauri::command]
fn list_stations() -> radio::ApiResult<radio::Catalog> {
    radio::list_stations().into()
}

#[tauri::command]
async fn resolve_stream(
    station_id: String,
    request_id: u64,
    app: tauri::AppHandle,
) -> radio::ApiResult<radio::ResolvedStream> {
    app.state::<playback::Resolver>()
        .resolve(&station_id, request_id)
        .await
        .into()
}

#[tauri::command]
fn cancel_resolve_stream(request_id: u64, state: tauri::State<'_, playback::Resolver>) {
    state.cancel(request_id);
}

#[tauri::command]
async fn get_programs(station_ids: Vec<String>) -> radio::ApiResult<Vec<programs::ProgramState>> {
    programs::get_programs(station_ids).await.into()
}

#[tauri::command]
async fn get_schedule(station_id: String) -> radio::ApiResult<programs::Schedule> {
    programs::get_schedule(station_id).await.into()
}

pub fn run() {
    let builder = desktop::plugins(tauri::Builder::default()).plugin(power::plugin());
    #[cfg(feature = "direct")]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(updates::PendingUpdate::default());
    builder
        .manage(playback::Resolver::default())
        .setup(|app| {
            desktop::setup(app)?;
            tray::setup(app)
        })
        .invoke_handler(tauri::generate_handler![
            open_about_page,
            #[cfg(feature = "direct")]
            updates::prepare_update,
            #[cfg(feature = "direct")]
            updates::install_update,
            list_stations,
            resolve_stream,
            cancel_resolve_stream,
            get_programs,
            get_schedule,
            tray::set_player_size,
            tray::set_player_pinned,
            tray::start_player_drag,
            tray::set_tray_playing,
            tray::set_tray_state,
            tray::set_player_opacity,
            tray::open_station_page,
            settings::load_settings,
            settings::save_settings,
            desktop::get_autostart,
            desktop::set_autostart,
            tray::quit_app,
            tray::frontend_ready,
        ])
        .run(tauri::generate_context!())
        .expect("앱 실행에 실패했습니다");
}
