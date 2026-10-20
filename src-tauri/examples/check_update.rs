// Checks the public updater. Optional installation touches only an isolated test copy.
use tauri_plugin_updater::UpdaterExt;
fn main() {
    let install_copy = std::env::args().any(|arg| arg == "--install-copy");
    let copy = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../artifacts/update-probe/Radio.app/Contents/MacOS/motungi-radio");
    let mut context = tauri::generate_context!();
    context.config_mut().app.windows.clear();
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .build(context)
        .expect("probe host");
    tauri::async_runtime::block_on(async {
        let mut builder = app
            .updater_builder()
            .version_comparator(|_, remote| {
                remote.version > "0.2.9".parse().expect("baseline version")
            })
            .timeout(std::time::Duration::from_secs(60));
        if install_copy {
            assert!(copy.exists());
            builder = builder.executable_path(&copy);
        }
        let updater = builder.build().expect("updater builder");
        let mut update = updater
            .check()
            .await
            .expect("public feed check")
            .expect("new release");
        println!("Update found: {}", update.version);
        update.timeout = Some(std::time::Duration::from_secs(300));
        let bytes = update
            .download(|_, _| {}, || {})
            .await
            .expect("download and signature verification");
        println!("Verified {} bytes", bytes.len());
        if install_copy {
            update.install(&bytes).expect("install into isolated copy");
            println!("Isolated install succeeded; no restart performed");
        }
    });
}
