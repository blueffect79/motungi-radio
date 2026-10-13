//! Only signed artifacts from our release repository can be installed.
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    version: Option<String>,
    supported: bool,
}
fn trusted(url: &url::Url) -> bool {
    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url.username().is_empty()
        && url.password().is_none()
        && url.port_or_known_default() == Some(443)
        && url
            .path()
            .starts_with("/devsejong/motungi-radio/releases/download/")
}
#[tauri::command]
pub async fn prepare_update(app: tauri::AppHandle) -> Result<UpdateStatus, String> {
    let supported = !cfg!(target_os = "linux") || std::env::var_os("APPIMAGE").is_some();
    if !supported {
        return Ok(UpdateStatus {
            version: None,
            supported,
        });
    }
    let state = app.state::<PendingUpdate>();
    let mut pending = state.0.lock().await;
    if let Some((update, _)) = pending.as_ref() {
        return Ok(UpdateStatus {
            version: Some(update.version.clone()),
            supported,
        });
    }
    let update = app
        .updater_builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|_| "업데이트를 준비할 수 없습니다.")?
        .check()
        .await
        .map_err(|_| "업데이트를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.")?;
    if let Some(mut update) = update {
        update.timeout = Some(std::time::Duration::from_secs(300));
        if !trusted(&update.download_url) {
            return Err("공식 업데이트 주소가 아닙니다.".into());
        }
        let bytes = update
            .download(|_, _| {}, || {})
            .await
            .map_err(|_| "업데이트 다운로드 또는 서명 확인에 실패했습니다.".to_string())?;
        let version = Some(update.version.clone());
        *pending = Some((update, bytes));
        Ok(UpdateStatus { version, supported })
    } else {
        Ok(UpdateStatus {
            version: None,
            supported,
        })
    }
}
#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<PendingUpdate>();
    let mut pending = state.0.lock().await;
    let (update, bytes) = pending.as_ref().ok_or("준비된 업데이트가 없습니다.")?;
    update.install(bytes).map_err(|_| {
        "설치에 실패했습니다. 앱을 Applications에 설치했는지 확인하거나 수동 설치해 주세요."
            .to_string()
    })?;
    *pending = None;
    app.restart();
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn release_scope_is_exact() {
        assert!(trusted(
            &url::Url::parse("https://github.com/devsejong/motungi-radio/releases/download/v1/a")
                .unwrap()
        ));
        for bad in [
            "http://github.com/devsejong/motungi-radio/releases/download/v1/a",
            "https://github.com/other/repo/releases/download/v1/a",
            "https://github.com.evil.test/devsejong/motungi-radio/releases/download/v1/a",
        ] {
            assert!(!trusted(&url::Url::parse(bad).unwrap()));
        }
    }
}
