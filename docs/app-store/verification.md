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

## 2026-10-18 제출 준비

- 공통 코드에서 direct / Mac App Store / Microsoft Store 경로를 분리했다. 프런트 61개·직접 배포 Rust 55개·Mac 스토어 Rust 55개(외부 검사 각각 5개 제외), 배포/CPU 검사 10개 통과.
- 개인정보처리방침을 https://devsejong.github.io/motungi-radio/privacy.html 에 게시했다. 문의 주소와 앱/웹 통계 차이, 자동 삭제 설정 미확인을 표시한다.
- Music 카테고리와 스토어 전용 Info.plist(HTTPS 표준 암호화에 대한 non-exempt encryption false)를 추가했다.
- `package-mac-store.py`는 명시적 앱 ID·팀·만료·배포 프로파일·인증서 개인키 일치를 검사하고 샌드박스 권한으로 앱을 서명한 후 Installer 인증서로 pkg를 생성한다. 잘못된/만료된/개발용 프로파일 거부 단위검증 통과.
- 현재 키체인의 유효 코드서명 인증서는 Developer ID Application 한 개다. Apple Distribution/3rd Party Mac Developer Application 및 Mac Installer Distribution, Mac App Store 프로비저닝은 아직 확보하지 않았다. Developer ID 공증은 App Store 서명을 대신하지 않는다.
- 업로드·심사·배포는 아직 수행하지 않았다. Privacy Manifest의 required-reason API 감사, 실기기 샌드박스 청취·로그인·절전, 콘텐츠 권한 자료 확인도 필요하다.
