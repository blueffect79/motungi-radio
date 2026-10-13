//! Store adapter: no LaunchAgent files or shell commands. UI stays gated until login tests.
use super::AutostartState;
use crate::radio::{AppError, ErrorCode};
use objc2_service_management::{SMAppService, SMAppServiceStatus};
fn state(status: SMAppServiceStatus) -> Result<AutostartState, AppError> {
    if status == SMAppServiceStatus::RequiresApproval {
        return Err(AppError::new(
            ErrorCode::OsRegistration,
            "시스템 설정의 로그인 항목에서 모퉁이 라디오를 허용해 주세요.",
            true,
        ));
    }
    if status == SMAppServiceStatus::NotFound {
        return Err(super::error());
    }
    Ok(AutostartState {
        enabled: status == SMAppServiceStatus::Enabled,
    })
}
pub fn query() -> Result<AutostartState, AppError> {
    // macOS 13 is the minimum deployment target. The main app service owns no user path.
    state(unsafe { SMAppService::mainAppService().status() })
}
pub fn set(enabled: bool) -> Result<AutostartState, AppError> {
    let service = unsafe { SMAppService::mainAppService() };
    if enabled && unsafe { service.status() } == SMAppServiceStatus::Enabled {
        return query();
    }
    if !enabled && unsafe { service.status() } == SMAppServiceStatus::NotRegistered {
        return query();
    }
    unsafe {
        if enabled {
            service.registerAndReturnError()
        } else {
            service.unregisterAndReturnError()
        }
    }
    .map_err(|_| super::error())?;
    let actual = query()?;
    if actual.enabled != enabled {
        return Err(super::error());
    }
    Ok(actual)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn registration_status_is_not_assumed_to_be_enabled() {
        assert!(state(SMAppServiceStatus::Enabled).unwrap().enabled);
        assert!(!state(SMAppServiceStatus::NotRegistered).unwrap().enabled);
        assert!(state(SMAppServiceStatus::RequiresApproval).is_err());
        assert!(state(SMAppServiceStatus::NotFound).is_err());
    }
}
