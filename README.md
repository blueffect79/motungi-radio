# 모퉁이 라디오

화면 한쪽, 좋아하는 방송. Mac 메뉴 막대·Windows 트레이에서 듣는 무료 한국 라디오 앱입니다.

## 기능

- 20개 채널: MBC·KBS·SBS·EBS·종교방송·TBN 경인
- 현재·다음 프로그램, 이미지, 날짜별 편성표
- 즐겨찾기, 음량, 마지막 채널 기억
- 채널 목록 접기, 압정 고정, 라이트·다크 테마
- 로그인 시 실행. 재생은 직접 시작합니다.

## 설치

macOS 13 이상(Apple Silicon·Intel), Windows 10/11 x64를 목표로 합니다. Mac·Windows 무료 시험판을 GitHub Releases에서 제공합니다. Linux x64 시험판은 Ubuntu·Mint를 우선 대상으로 준비합니다.

[홈페이지](https://devsejong.github.io/motungi-radio/) · [설치 안내](docs/install.md) · [지원 채널](docs/station-support.md) · [검증 기록](docs/verification.md)

홈페이지 코드는 `site/`에서 앱과 함께 관리하고 GitHub Pages로 배포합니다.

## 개발

Node.js 22, Rust stable, [Tauri 개발 도구](https://v2.tauri.app/start/prerequisites/)가 필요합니다.

```sh
npm ci
npm run verify
cargo test --locked --manifest-path src-tauri/Cargo.toml
npm run tauri -- dev
```

[설계](docs/architecture.md) · [작업 기준](AGENTS.md) · [배포 검사](docs/release-checklist.md)

## 권리

앱 코드는 [MIT](LICENSE). 방송 콘텐츠의 권리는 각 방송사에 있습니다. 공식 앱이 아니며 MBC 공개 배포 조건 확인이 남아 있습니다.
