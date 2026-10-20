# 개발과 시험본 생성

UI 검증은 `cargo run --locked --manifest-path src-tauri/Cargo.toml --example preview_fixture > src/dev/metadata.json`으로 공식 정보 스냅샷을 갱신한 뒤 `npm run preview:ui`로 실행한다. http://127.0.0.1:1421/preview.html 에서 같은 App.ts를 사용한다. 오디오·네이티브 창·설정 저장은 개발 어댑터이므로 실제 OS 동작으로 판정하지 않는다. 일반 화면은 380×640, 미니모드는 320×98이며 오류가 있으면 높이가 늘어난다. 채널 목록만 접은 화면은 380px 폭을 유지한다. 배포 빌드에는 검증 어댑터가 연결되지 않는다.

Node.js 22, npm, Rust stable을 먼저 설치한다. Mac은 Xcode Command Line Tools, Windows는 MSVC C++ 도구와 WebView2가 필요하다. 저장소 루트에서 다음 순서로 실행한다.

```sh
npm ci
npm run verify
cargo test --locked --manifest-path src-tauri/Cargo.toml
node --test scripts/check-binary-architecture.test.mjs
node scripts/check-package.mjs
npm run tauri -- dev
```

방송 목록은 앱에 포함된다. 서버·데이터베이스·API 키 초기화는 없다. 개발 실행에서 방송사 요청은 실제 네트워크를 사용하므로 일반 단위 테스트와 구분한다.

Mac 설치파일은 대상 Rust 표준 라이브러리를 먼저 설치한 뒤 만든다.

```sh
rustup target add aarch64-apple-darwin x86_64-apple-darwin
CI=true npm run tauri -- build --target aarch64-apple-darwin --bundles dmg
CI=true npm run tauri -- build --target x86_64-apple-darwin --bundles dmg
```

Windows PowerShell에서는 `$env:CI='true'`를 지정하고 `npm run tauri -- build --target x86_64-pc-windows-msvc --bundles nsis`를 실행한다. 실제 Windows 설치 시험은 Mac 크로스 빌드로 대체하지 않는다.

CARGO_HOME/RUSTUP_HOME은 Rust 설치 위치, CARGO_TARGET_DIR은 빌드 출력 위치다. 설정하지 않으면 시스템 기본값을 사용한다. npm의 tauri 래퍼는 프로젝트에 .local-tools/cargo가 있으면 그 도구체인을 선택한다. 직접 cargo를 실행할 때는 동일한 환경을 명시한다. CI=true는 GUI 배치 작업 생략에 사용하며 권한 확인이나 기능 테스트를 대신하지 않는다.

GitHub의 package.yml은 workflow_dispatch의 platform=all/windows/macos/linux로 실행한다. 설치파일과 SHA256이 artifact에 14일 보관되며 자동 공개 릴리스는 만들지 않는다. 생성된 설치파일을 읽기 전용으로 검사하고 실기기 결과와 공개 조건을 확인한 뒤 공개 여부를 결정한다. 앱 소스·홈페이지·Releases는 같은 공개 저장소에서 관리한다.

## Linux

Ubuntu 22.04에서 Tauri의 [Linux 의존성](https://v2.tauri.app/start/prerequisites/)과 GStreamer base/good/bad/libav 플러그인을 설치합니다.

```sh
npm run tauri -- build --target x86_64-unknown-linux-gnu --bundles deb,appimage
node scripts/package-artifacts.mjs x86_64-unknown-linux-gnu src-tauri/target/x86_64-unknown-linux-gnu/release/bundle dist-packages/linux-x64
# GitHub Ubuntu에서 빌드와 설치본 검사
gh workflow run package.yml --ref codex/player-redesign -f platform=linux
```

CI는 `.deb`를 설치하고 Xvfb·Openbox·Tauri WebDriver로 실제 IPC 채널 목록, 무음 시작, 미니·설정 화면을 확인합니다. 결과 PNG는 설치파일 artifact의 `proof/`에 저장합니다. 실제 소리 출력·트레이·로그인·절전 시험을 대신하지 않습니다.

## 0.2.10 미니모드

상단 축소 아이콘으로 320×98px 미니모드에 진입하고 확대 아이콘으로 복귀한다. 채널 목록 접기와 별개이며 같은 재생기를 유지한다. 미니모드에서도 이전·재생/정지·다음 버튼과 고정을 제공한다. 오류가 있으면 높이가 늘어난다. 앱을 새로 실행하면 일반 화면으로 시작한다. Linux는 모드 전환 시 창 폭 제한도 함께 변경한다.
