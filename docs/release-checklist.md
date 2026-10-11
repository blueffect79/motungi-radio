# 설치파일 빌드와 릴리스 검증

## 빌드 전

- [ ] MBC 재링크 고지 등 방송사 이용 조건과 배포 목적을 확인한다. 영리 제한과 별도 허가 여부를 구분하며, 적용되는 제한을 어긴 상태로 공개하지 않는다.
- [ ] 자체 코드 MIT와 콘텐츠·외부 라이브러리의 별도 권리를 명확히 표시한다.
- [ ] 버전(package.json/tauri.conf.json/Cargo.toml), 방송 목록, 실제 지원 범위를 확인한다.
- [ ] `node scripts/check-package.mjs`, `npm run verify`, `cargo test --locked --manifest-path src-tauri/Cargo.toml`을 통과한다.

## 로컬 빌드

Developer ID 서명·Apple 공증 배포는 [Mac 서명·공증](macos-signing.md)의 전용 빌드 명령을 사용한다. 아래 일반 빌드 및 현재 Actions 빌드는 임시 서명이다.

빌드는 대상 운영체제에서 수행한다. macOS에서 Windows 설치 검증을 대신하지 않는다. Rust target을 먼저 설치한다.

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
CI=true npm run tauri -- build --target aarch64-apple-darwin --bundles dmg
CI=true npm run tauri -- build --target x86_64-apple-darwin --bundles dmg
```

`CI=true`는 Tauri DMG 생성기의 Finder 화면 배치용 AppleScript를 생략한다. 배경·아이콘 배치는 일반 데스크톱 생성과 다를 수 있다. 잠금 화면을 풀거나 GUI를 자동 조작하지 않는다. Windows PowerShell:

```powershell
rustup target add x86_64-pc-windows-msvc
$env:CI = 'true'
npm run tauri -- build --target x86_64-pc-windows-msvc --bundles nsis
```

기본 산출물은 `src-tauri/target/<target>/release/bundle/` 아래에 생성된다. CARGO_TARGET_DIR을 지정했다면 그 폴더 아래를 사용한다. 다음 스크립트는 bundle 폴더 바로 위의 실제 motungi-radio 실행파일(Windows는 motungi-radio.exe)의 CPU가 target과 일치하는지 먼저 검증한다. Windows 앱은 AMD64 PE32+, Mac 앱은 arm64/x64 thin Mach-O여야 한다. NSIS 설치기 자체가 32비트인 것은 허용한다. 이후 실제 설치파일이 정확히 하나인지, DMG/PE 헤더와 크기를 확인하고 배포명으로 복사한 다음 해시를 재검증한다. 출력 폴더는 비어 있어야 한다.

```sh
node scripts/package-artifacts.mjs aarch64-apple-darwin src-tauri/target/aarch64-apple-darwin/release/bundle /tmp/motungi-radio-macos-arm64
```

이는 형식·해시 검증이며 실행 가능성·안전성·설치 성공 보증이 아니다. macOS는 `hdiutil verify <dmg>` 및 `codesign --verify --deep --strict <app>`을 추가 확인하고 `codesign -dv --verbose=4 <app>`으로 ad-hoc임을 기록한다.

아키텍처 검증의 잘못된 CPU·잘린 헤더 회귀 테스트는 `node --test scripts/check-binary-architecture.test.mjs`로 실행한다.

## GitHub Actions

`.github/workflows/package.yml`을 기본 브랜치에 올린 후 Actions → 설치파일 검증 빌드 → Run workflow를 수동 실행한다. `platform=all`은 macOS arm64/x64와 Windows x64, `windows` 또는 `macos`는 선택한 운영체제만 빌드한다. 최소 권한은 contents:read이며 release 생성·업로드·공개 작업은 없다. 선택하지 않은 조합은 단계가 생략될 수 있다.

각 작업은 의존성 설치, 메타데이터 확인, 프런트엔드·Rust 테스트, 실제 번들 빌드, SHA256 생성 후 별도의 artifact를 14일 보관한다. 초기에는 비공개 staging에서도 실행할 수 있다. Actions artifact 접근에는 GitHub 로그인/저장소 권한이 필요하며 일반 사용자 다운로드 링크를 대신하지 않는다. 선택 실행 성공을 3개 대상 전체 성공으로 보고하지 않는다.

Runner와 action 버전은 2026-10-09에 [GitHub runner 문서](https://docs.github.com/en/actions/reference/runners/github-hosted-runners), [checkout](https://github.com/actions/checkout/releases/tag/v7.0.1), [setup-node](https://github.com/actions/setup-node/releases/tag/v7.1.0), [upload-artifact](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)에서 확인했다. DMG 동작은 [Tauri 안내](https://v2.tauri.app/distribute/dmg/)를 참고한다.

## 설치파일 생성 후 필수 확인

- [ ] 세 대상 각각 빌드 로그, commit SHA, 파일명·SHA256을 기록한다.
- [ ] 인터넷에서 받은 실제 DMG/EXE로 깨끗한 사용자 계정에 설치한다. macOS arm64/Intel, Windows 10/11 x64를 각각 기록한다.
- [ ] 첫 실행 보안 경고, 메뉴 막대/트레이, 창 열기·닫기, 완전 종료를 확인한다.
- [ ] 방송 전환, 재생/정지, 볼륨, 현재 프로그램/확인 불가 표시, 네트워크 단절·복구, 실제 스피커 청취를 확인한다.
- [ ] 로그인 시 자동 실행 켜기·끄기 후 실제 로그아웃/로그인으로 확인한다.
- [ ] 업데이트·설정 유지·삭제와 WebView2 미설치 환경을 확인한다.
- [ ] 사용자의 공개 요청과 방송사 이용 조건을 확인한 뒤 draft release에 파일·해시를 올린다. 실기기 미검증 범위와 미서명 상태를 명시하고 공개 다운로드를 검증한다.

## 현재 미검증 범위

0.2.6 Mac 두 DMG는 Developer ID 서명·공증·Gatekeeper를 통과했고 Windows x64는 빌드·CPU·형식 검사를 통과했다. Windows는 미서명이다. Linux 두 설치 형식은 가상 화면에서 WebKit/IPC·고정·투명도 명령·트레이 설정/정지 이벤트·EBS 스트리밍을 검사했다. Mac·Windows 실제 UI와 실기기 청취·로그인·절전·Windows WebView2 미설치 환경은 미검증이다. 자동 테스트·빌드·공증을 실제 설치·청취 성공으로 합산하지 않는다. 버전별 근거는 [검증 기록](verification.md)을 따른다.
