pub mod radio;
pub mod programs;
pub mod settings;
pub mod desktop;

#[tauri::command]
fn list_stations() -> radio::ApiResult<radio::Catalog> {
    radio::list_stations().into()
}

#[tauri::command]
async fn resolve_stream(station_id: String) -> radio::ApiResult<radio::ResolvedStream> {
    radio::resolve_stream(&station_id).await.into()
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![list_stations, resolve_stream])
        .run(tauri::generate_context!())
        .expect("앱 실행에 실패했습니다");
}
