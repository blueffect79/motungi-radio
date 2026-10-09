# 한국 라디오

한국 라디오 방송을 메뉴 막대(macOS) 또는 알림 영역(Windows)에서 선택하는 무료 데스크톱 앱입니다. 공식 방송 소스를 조회하며 인터넷 연결이 필요합니다. 방송사의 공식 앱이 아니며 방송 콘텐츠를 소유하지 않습니다.

목표 환경은 macOS 13 이상 Apple Silicon/Intel 및 Windows 10/11 x64입니다. 설치파일은 DMG와 NSIS EXE로 준비합니다. 현재는 배포 준비 단계이며, 빌드 성공과 실제 설치·청취 성공은 구분합니다. 공개 다운로드가 있다고 가정하지 마세요.

- [설치·업데이트 안내](docs/install.md)
- [릴리스 검증 체크리스트](docs/release-checklist.md)
- [방송 지원 범위](docs/station-support.md)

## 개발

Node.js 22, npm, Rust stable 및 [Tauri 운영체제별 개발 도구](https://v2.tauri.app/start/prerequisites/)가 필요합니다. Windows에는 MSVC C++ 빌드 도구와 WebView2, macOS에는 Xcode Command Line Tools가 필요합니다.

```sh
npm ci
npm run verify
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- dev
```

빌드·설치 검증 절차는 릴리스 체크리스트를 따릅니다. Actions는 수동 실행으로 각 운영체제 설치파일과 SHA256을 artifact에 보관하며 공개 릴리스를 자동 발행하지 않습니다.

## 권리와 현재 한계

자체 작성 앱 코드는 [MIT](LICENSE)입니다. 방송 음원·방송사 로고·편성 데이터·외부 라이브러리는 각 권리자에게 권리가 있습니다. 특히 MBC 원천 클라이언트의 재링크 관련 고지가 있어 공개 배포 허가 확인이 남아 있습니다. 소스 접근 성공은 배포 허가를 의미하지 않습니다.

공식 스트림 32개에 대해 주소 조회와 미디어 조각 응답을 확인했지만, 모든 채널의 스피커 청취를 검증했다는 뜻은 아닙니다. 현재 프로그램은 18개 채널에서 응답을 확인했습니다. TBN 13개는 네이티브 TLS 조회 실패, KBS 한민족은 내부 채널 불일치로 확인 불가 상태입니다. 실제 화면·청취·로그인 시 자동 실행·Windows 실기기 검증은 별도 확인이 필요합니다.
