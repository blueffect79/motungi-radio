# 개발 번들 검증 — 2026-10-13

- 커밋 전 작업 트리에서 `npm run desktop:appstore -- --debug --bundles app` 성공.
- 출력: `src-tauri/target-appstore/debug/bundle/macos/모퉁이 라디오.app`. 임시 서명이며 스토어 제출물은 아니다.
- codesign strict 검증, Sandbox/network.client entitlement, LSUIElement=true, 기존 bundle ID 확인.
- 실제 앱 실행 → 설정의 App Store 안내·정보 표기 → 라이트 모드 저장 → 종료·재실행 유지 확인. 검증 후 시스템 모드 복원·종료.
- 캡처: `artifacts/appstore/native-settings.png`.
- 프런트 59개, 직접 배포 Rust 50개, 스토어 Rust 50개 통과. Rust live 검사 각 5개 제외.
- 빌드 경계 3개, 아키텍처 검사 6개, 패키지 사전검사 통과. 스토어 의존성에서 updater/autostart 플러그인 제외 확인.
- 로그인 자동 실행은 SMAppService 상태 변환 검사만 완료. OS 등록·해제·로그인 시작은 미검증이므로 UI 비활성화 유지.
- 실제 청취·절전 복귀·스토어 제출 서명·심사·원격 CI 실행은 미검증.
