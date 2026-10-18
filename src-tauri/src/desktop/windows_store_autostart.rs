//! MSIX startup registration; never writes the unpackaged app's Run registry entry.
use super::{error, AutostartState};
use crate::radio::{AppError, ErrorCode};
use windows::{core::HSTRING, ApplicationModel::{StartupTask, StartupTaskState}};
async fn task() -> Result<StartupTask, AppError> {
    StartupTask::GetAsync(&HSTRING::from("MotungiRadioStartup"))
        .map_err(|_| error())?.await.map_err(|_| error())
}
pub async fn query() -> Result<AutostartState, AppError> {
    let state = task().await?.State().map_err(|_| error())?;
    Ok(AutostartState { enabled: state == StartupTaskState::Enabled || state == StartupTaskState::EnabledByPolicy })
}
pub async fn set(enabled: bool) -> Result<AutostartState, AppError> {
    let task = task().await?;
    if enabled { task.RequestEnableAsync().map_err(|_| error())?.await.map_err(|_| error())?; }
    else { task.Disable().map_err(|_| error())?; }
    let actual = query().await?;
    if actual.enabled != enabled {
        return Err(AppError::new(ErrorCode::OsRegistration,
            "Windows 설정의 앱 > 시작 프로그램에서 모퉁이 라디오의 실행 권한을 확인해 주세요.", true));
    }
    Ok(actual)
}
