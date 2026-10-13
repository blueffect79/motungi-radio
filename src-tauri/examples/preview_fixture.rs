// Sanitized metadata snapshot for the explicitly enabled browser UI preview. No streams or tokens.
fn main() {
    tauri::async_runtime::block_on(async {
        let mut catalog = motungi_radio_lib::radio::list_stations().unwrap();
        catalog
            .stations
            .retain(|s| s.group_id.as_deref() != Some("tbn") || s.id == "tbn-gyeongin");
        let programs = motungi_radio_lib::programs::get_programs(
            catalog.stations.iter().map(|s| s.id.clone()).collect(),
        )
        .await
        .unwrap();
        let schedule = motungi_radio_lib::programs::get_schedule("mbc-mfm".into())
            .await
            .unwrap();
        println!(
            "{}",
            serde_json::json!({"catalog":catalog,"programs":programs,"schedule":schedule})
        );
    });
}
