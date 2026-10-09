use tauri::Manager;

pub mod desktop;
pub mod playback;
pub mod programs;
pub mod radio;
pub mod settings;
pub mod tray;

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

pub fn run() {
    desktop::plugins(tauri::Builder::default())
        .manage(playback::Resolver::default())
        .setup(|app| {
            desktop::setup(app)?;
            tray::setup(app)
        })
        .invoke_handler(tauri::generate_handler![
            list_stations,
            resolve_stream,
            cancel_resolve_stream,
            get_programs,
            settings::load_settings,
            settings::save_settings,
            desktop::get_autostart,
            desktop::set_autostart,
            tray::quit_app,
        ])
        .run(tauri::generate_context!())
        .expect("앱 실행에 실패했습니다");
}
