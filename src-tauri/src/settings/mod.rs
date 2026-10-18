#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn path() -> std::path::PathBuf {
        std::env::temp_dir()
            .join(format!(
                "motungi-radio-settings-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ))
            .join("settings.json")
    }
    #[test]
    fn restores_valid_fields_and_bounds() {
        let s = restore(
            json!({"schemaVersion":1,"volume":101,"favoriteIds":["gone","gone",4],"lastStationId":"gone","tbnStationId":"gone"}),
        );
        assert_eq!(s.volume, 100.0);
        assert_eq!(s.favorite_ids, vec!["gone"]);
        assert_eq!(s.last_station_id.as_deref(), Some("gone"));
        assert_eq!(s.tbn_station_id, None);
        for n in [0.0, 100.0] {
            assert_eq!(restore(json!({"volume":n})).volume, n)
        }
    }
    #[test]
    fn appearance_and_mode_survive_restart_and_reject_invalid_values() {
        let p = path();
        let store = SettingsStore::new(p.clone());
        let mut s = Settings::default();
        s.onboarding_completed = true;
        s.appearance = "dark".into();
        s.player_mode = "mini".into();
        store.save(s.clone()).unwrap();
        assert_eq!(SettingsStore::new(p).load().unwrap(), s);
        let restored = restore(json!({"appearance":"broken", "playerMode":"bad"}));
        assert_eq!(restored.appearance, "system");
        assert_eq!(restored.player_mode, "full");
    }
    #[test]
    fn future_schema_is_not_overwritten() {
        let p = path();
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(&p, r#"{"schemaVersion":2,"volume":30}"#).unwrap();
        let store = SettingsStore::new(p.clone());
        assert_eq!(store.load().unwrap().volume, 100.0);
        assert!(store.save(Settings::default()).is_err());
        assert!(std::fs::read_to_string(p).unwrap().contains(":2"));
    }
    #[test]
    fn restart_corruption_and_write_failure() {
        let p = path();
        let store = SettingsStore::new(p.clone());
        let mut s = Settings::default();
        s.favorite_ids = vec!["deleted".into()];
        store.save(s.clone()).unwrap();
        assert_eq!(SettingsStore::new(p.clone()).load().unwrap(), s);
        std::fs::write(&p, b"broken json").unwrap();
        assert_eq!(store.load().unwrap(), Settings::default());
        let bad = p.join("bad");
        assert!(SettingsStore::new(bad).save(s).is_err());
    }
    #[test]
    fn concurrent_writes_leave_complete_json() {
        let p = path();
        let store = std::sync::Arc::new(SettingsStore::new(p.clone()));
        let handles: Vec<_> = (0..8)
            .map(|n| {
                let store = store.clone();
                std::thread::spawn(move || {
                    let mut s = Settings::default();
                    s.volume = n as f64;
                    store.save(s).unwrap();
                })
            })
            .collect();
        for h in handles {
            h.join().unwrap()
        }
        assert!(store.load().unwrap().volume < 8.0);
        assert!(serde_json::from_slice::<serde_json::Value>(&std::fs::read(p).unwrap()).is_ok());
    }
}

use crate::radio::{ApiResult, AppError, ErrorCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashSet, fs, io::Write, path::PathBuf, sync::Mutex};
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub schema_version: u32,
    #[serde(default)]
    pub analytics_enabled: bool,
    #[serde(default)]
    pub onboarding_completed: bool,
    #[serde(default = "system_appearance")]
    pub appearance: String,
    #[serde(default = "full_mode")]
    pub player_mode: String,
    pub favorite_ids: Vec<String>,
    pub volume: f64,
    pub last_station_id: Option<String>,
    pub tbn_station_id: Option<String>,
}
fn system_appearance() -> String {
    "system".into()
}
fn full_mode() -> String {
    "full".into()
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            analytics_enabled: false,
            onboarding_completed: false,
            appearance: system_appearance(),
            player_mode: full_mode(),
            favorite_ids: vec![],
            volume: 100.0,
            last_station_id: None,
            tbn_station_id: None,
        }
    }
}
fn storage() -> AppError {
    AppError::new(
        ErrorCode::Storage,
        "설정을 저장하거나 불러올 수 없습니다.",
        true,
    )
}
fn id(v: &Value) -> Option<String> {
    v.as_str().filter(|s| !s.is_empty()).map(str::to_owned)
}
fn future(v: &Value) -> bool {
    v.get("schemaVersion")
        .and_then(Value::as_u64)
        .is_some_and(|n| n > 1)
}
fn restore(v: Value) -> Settings {
    let mut s = Settings::default();
    if future(&v) {
        return s;
    }
    if let Some(volume) = v["volume"]
        .as_f64()
        .filter(|n| n.is_finite() && (0.0..=100.0).contains(n))
    {
        s.volume = volume
    }
    if let Some(value) = v["appearance"]
        .as_str()
        .filter(|v| ["system", "light", "dark"].contains(v))
    {
        s.appearance = value.into();
    }
    if let Some(value) = v["playerMode"]
        .as_str()
        .filter(|v| ["full", "mini"].contains(v))
    {
        s.player_mode = value.into();
    }
    s.analytics_enabled = v["analyticsEnabled"].as_bool().unwrap_or(false);
    s.onboarding_completed = v["onboardingCompleted"].as_bool().unwrap_or(false);
    let mut seen = HashSet::new();
    if let Some(ids) = v["favoriteIds"].as_array() {
        s.favorite_ids = ids
            .iter()
            .filter_map(id)
            .filter(|id| seen.insert(id.clone()))
            .collect()
    }
    s.last_station_id = id(&v["lastStationId"]);
    // The shortcut must target a CURRENT TBN member. Removed IDs survive in last/favorites only.
    s.tbn_station_id = id(&v["tbnStationId"]).filter(|id| {
        crate::radio::list_stations().is_ok_and(|c| {
            c.stations
                .iter()
                .any(|station| station.id == *id && station.group_id.as_deref() == Some("tbn"))
        })
    });
    s
}
pub struct SettingsStore {
    path: PathBuf,
    writer: Mutex<()>,
}
impl SettingsStore {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            writer: Mutex::new(()),
        }
    }
    fn read(&self) -> Result<Value, AppError> {
        match fs::read(&self.path) {
            Ok(bytes) => Ok(serde_json::from_slice(&bytes).unwrap_or(Value::Null)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Value::Null),
            Err(_) => Err(storage()),
        }
    }
    pub fn load(&self) -> Result<Settings, AppError> {
        let _guard = self.writer.lock().map_err(|_| storage())?;
        Ok(restore(self.read()?))
    }
    pub fn save(&self, input: Settings) -> Result<Settings, AppError> {
        let _guard = self.writer.lock().map_err(|_| storage())?;
        if future(&self.read()?) {
            return Err(AppError::new(
                ErrorCode::Storage,
                "더 최신 버전의 설정입니다. 앱을 업데이트해 주세요.",
                false,
            ));
        }
        if input.schema_version != 1 {
            return Err(storage());
        }
        let settings = restore(serde_json::to_value(input).map_err(|_| storage())?);
        let parent = self.path.parent().ok_or_else(storage)?;
        fs::create_dir_all(parent).map_err(|_| storage())?;
        let temporary = self.path.with_extension("json.tmp");
        let result = (|| {
            let mut file = fs::File::create(&temporary)?;
            file.write_all(&serde_json::to_vec(&settings).map_err(std::io::Error::other)?)?;
            file.sync_all()?;
            drop(file);
            fs::rename(&temporary, &self.path)?;
            Ok::<(), std::io::Error>(())
        })();
        if result.is_err() {
            let _ = fs::remove_file(&temporary);
            return Err(storage());
        }
        Ok(settings)
    }
}
#[tauri::command]
pub fn load_settings(store: tauri::State<'_, SettingsStore>) -> ApiResult<Settings> {
    store.load().into()
}
#[tauri::command]
pub fn save_settings(
    settings: Settings,
    store: tauri::State<'_, SettingsStore>,
) -> ApiResult<Settings> {
    store.save(settings).into()
}
