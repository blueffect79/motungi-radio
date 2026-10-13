# 하나의 코드, 두 배포 경로

main에서 공통 기능을 관리한다. 스토어용 장기 브랜치나 앱 소스 복사본은 만들지 않는다.

|항목|직접 배포|Mac App Store|
|---|---|---|
|명령|npm run desktop:direct|npm run desktop:appstore|
|Rust feature|direct (기본)|app-store, 기본 feature 해제|
|프런트|dist|dist-appstore|
|네이티브 빌드|src-tauri/target|src-tauri/target-appstore|
|자체 업데이터|포함|의존성·네이티브 명령·플러그인 제외|
|설정 업데이트 항목|직접 확인/설치|App Store 안내|
|정보 화면|직접 배포|App Store|
|로그인 자동 실행|기존 LaunchAgent|준비 중, 비활성화|

두 feature를 함께 넣으면 컴파일 오류로 막는다. 스토어 빌드는 제공된 명령으로 실행해 프런트 모드와 Rust feature를 함께 맞춘다. 프런트 출력은 별도 폴더여서 교차 빌드 때 덮어쓰지 않는다. 기본 App ID는 유지하며 프로파일도 같은 ID를 사용한다. 같은 앱의 두 배포판 동시 설치·실행은 지원 대상으로 삼지 않는다.

제품 버전(package.json·Cargo.toml·tauri.conf.json)은 동일하게 유지한다. 심사 재제출의 빌드 번호는 별도 bundle.macOS.bundleVersion으로 증가시킨다. 각각의 빌드에 source commit·제품 버전·빌드 번호·배포 경로·검증 결과를 기록하고 공개 다운로드 링크가 가리키는 버전과 구분한다.

## 제출 전 남은 일

현재 App Store 설정은 개발용 뼈대다. 실제 제출 인증서·Mac Installer Distribution 인증서·프로비저닝 프로파일과 팀/application entitlement를 연결해야 한다. 임의 프로파일이나 인증서는 넣지 않았다. productbuild PKG·App Store Connect 업로드는 하지 않았다.

App Sandbox와 network.client entitlement만 준비했다. 샌드박스 앱을 직접 설치해 라디오 재생·저장·창·외부 링크·절전 복귀를 검증해야 한다. 로그인 자동 실행은 SMAppService 기반 어댑터를 구현하고 상태 매핑 테스트를 통과했다. 실제 등록·해제·로그인 시작 시험 후 UI를 활성화한다. 현재 스토어판은 LaunchAgent 플러그인 의존성 자체를 제외한다.

직접 배포판 설정을 샌드박스 컨테이너로 자동 복사하지 않는다. 첫 스토어 설치에는 기본값을 사용하며, 설정 가져오기/내보내기와 버전별 전환 안내는 제출 전에 구현할 항목이다. 기존 직접 배포판 설정 파일은 삭제하지 않는다.

방송·이미지 이용 권한 근거, PostHog 개인정보 고지, 실제 두 CPU 설치 검사와 심사 자료가 완료돼야 공개한다. 이번 변경은 빌드 분리이며 스토어 제출 가능 상태나 심사 통과를 의미하지 않는다.

## 원격 준비 결과 (2026-10-13)

- scripts/distribution-build.mjs에서 경로별 타깃 폴더와 Cargo 옵션을 고정하고 충돌 옵션을 거부한다. Tauri CLI에서 --no-default-features는 `--` 뒤 Cargo 인자로 전달한다.
- CI 검사 정의를 추가했다. 아직 커밋·푸시 전이므로 GitHub에서 실행한 결과는 아니다.
- App Store 개발용 `.app`을 debug로 실제 번들링했다. codesign 검증, Sandbox/network.client entitlement, LSUIElement, 앱 ID를 확인했다. 임시(ad-hoc) 서명이며 심사 제출물은 아니다.
- 네이티브 설정 화면에서 App Store 배포 경로 및 업데이트 안내를 확인했다. 라이트 모드 변경 후 종료·재실행에서도 유지됐으며, 검증 후 시스템 모드로 복원하고 앱을 종료했다. 청취·로그인·절전 복귀는 미검증이다.
- 키체인에서 Developer ID Application만 확인했다. 스토어 앱 배포 및 Installer 서명 준비는 남아 있다.
- [심사 설명 초안](app-store/submission-draft.md), [개인정보 초안](app-store/privacy-draft.md), [방송 권한 확인표](app-store/content-rights.md)를 준비했다. 모두 미게시·미제출이다.
