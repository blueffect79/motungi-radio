# Microsoft Store 배포

공통 제품 소스는 유지하고 direct, app-store(Mac), microsoft-store(Windows) 빌드를 구분한다. Microsoft Store 빌드는 Windows x64 전용이며 `npm run desktop:microsoft-store -- --target x86_64-pc-windows-msvc --no-bundle`로 빌드한다. 출력은 `src-tauri/target-microsoft-store`, 프런트는 `dist-microsoft-store`에 분리한다.

스토어판은 직접 배포 updater·autostart 플러그인을 포함하지 않는다. 업데이트는 Microsoft Store가 처리하고 로그인 실행은 MSIX StartupTask API를 사용한다. 시작 작업의 별도 helper가 `--autostart`로 앱을 시작해 창·오디오 자동 시작을 막는다. 사용자가 Windows 시작 프로그램에서 끈 권한은 성공으로 가장하지 않는다. 직접 설치판과 별도 앱 ID/설정 경로를 사용하며 기존 설정을 자동 이전하지 않는다.

## 등록 정보

2026-10-18 Partner Center에서 확인했다. 비밀 자격 증명은 아니다.

- 제품: 모퉁이 라디오
- Store ID: `9P5RR68464SX`
- Identity Name: `EA466DAE.395942762A201`
- Publisher: `CN=5FE78193-5A43-4768-8FA9-0207BF80006C`
- PublisherDisplayName: `유글레나`
- PFN: `EA466DAE.395942762A201_46m7zv2hp1s6j`

`packaging/microsoft-store/AppxManifest.xml`의 버전은 패키징 시 package.json에서 네 자리로 생성한다(0.2.9 → 0.2.9.0). 마지막 자리는 0을 유지한다. Windows SDK MakeAppx가 스키마를 검증한다. 새 빈 폴더에 exe·시작 helper·로고만 넣고 MSIX와 SHA256을 생성한다. 제출 파일은 미서명이며 심사 통과 후 Microsoft Store가 서명한다. 자체 시험 인증서를 제출·공개 자산에 넣지 않는다.

Windows 10 build 19041 이상 / Windows 11 x64, Evergreen WebView2 Runtime이 필요하다. Store의 .msix 경로는 NSIS WebView2 부트스트래퍼를 실행하지 않는다. WebView2 없는 Windows 10 환경은 별도 검증이 필요하다.

## 검증과 심사

`.github/workflows/microsoft-store.yml`을 수동 실행한다. 직접 배포와 Mac 스토어 프런트도 함께 빌드해 updater 명령 분리를 검사하고, Windows 네이티브 단위검증·빌드·아키텍처·MakeAppx·내용 검사를 수행한다. 실제 MSIX 설치/트레이·자동 실행·설정 유지·로그인·절전·청취 검증은 빌드 성공과 구분한다.

Partner Center에 무료 배포·음악 카테고리·개인정보처리방침·지원 링크, 한국어 소개 초안을 저장했다. Windows 캡처와 MSIX, 실시간 방송 콘텐츠 연령 설문 확정이 필요하다. 최종 심사 제출은 이 검증과 방송/이미지 사용 근거를 정리한 뒤 수행한다.

공식 근거: [Tauri MSIX 가이드](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/guides/tauri), [시작 작업](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions), [직접 MSIX 패키징](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion).
