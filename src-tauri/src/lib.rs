pub mod radio;
pub mod programs;
pub mod settings;
pub mod desktop;

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("앱 실행에 실패했습니다");
}
