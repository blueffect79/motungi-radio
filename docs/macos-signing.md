# Mac 서명·공증

Mac 0.2.9 Apple Silicon·Intel 설치파일은 Developer ID 서명·Apple 공증을 완료했다. [공개 릴리스](https://github.com/devsejong/motungi-radio/releases/tag/v0.2.9). 이전 0.2.1은 임시 서명이며 공증 전이다.

## 개발자 등록

1. [Apple Developer Program](https://developer.apple.com/kr/programs/enroll/)에 개인 또는 조직 명의로 등록한다. 개인은 이중 인증을 사용하는 Apple 계정과 법적 이름이 필요하다.
2. 본인 확인, 약관 동의, 연회비 결제 후 가입 승인을 기다린다. 연회비는 미화 99달러이며 실제 결제 금액은 등록 화면에서 확인한다.
3. Xcode → Settings → Accounts에 가입한 계정을 추가하고 팀을 선택한다. Manage Certificates에서 **Developer ID Application** 인증서를 생성한다. Apple Development 인증서와 구분한다.

비밀번호·인증코드·인증서 개인 키를 채팅이나 저장소에 올리지 않는다.

## 서명된 설치파일 빌드

인증서는 개인 키와 함께 로컬 Mac 키체인에 둔다. 공증에는 일반 로그인 암호가 아닌 [앱 전용 암호](https://support.apple.com/ko-kr/102654)를 사용한다.

암호를 환경변수에 두지 않으려면 터미널에서 `xcrun notarytool store-credentials motungi-radio`를 실행하고 안내에 따라 Apple 계정, 팀 ID, 앱 전용 암호를 입력한다. 그 뒤 `export APPLE_NOTARY_PROFILE=motungi-radio`를 설정한다. 이 방식은 DMG를 Apple에 공증 요청하고 승인된 확인표를 DMG에 첨부한다.

로컬 터미널에서 다음 변수를 설정한다. 아래 값은 예시이며, 암호 입력은 화면과 쉘 기록에 남기지 않는다(zsh).

```zsh
export APPLE_SIGNING_IDENTITY='Developer ID Application: 법적 이름 (TEAMID)'
export APPLE_ID='Apple 계정 이메일'
export APPLE_TEAM_ID='팀 ID'
read -rs 'APPLE_PASSWORD?Apple 앱 전용 암호: '
export APPLE_PASSWORD
```

또는 Tauri가 지원하는 `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`로 공증 API 인증을 구성할 수 있다.

```sh
node scripts/build-signed-macos.mjs aarch64-apple-darwin --check
rustup target add aarch64-apple-darwin x86_64-apple-darwin
CI=true node scripts/build-signed-macos.mjs aarch64-apple-darwin
CI=true node scripts/build-signed-macos.mjs x86_64-apple-darwin
```

이 명령은 기본 임시 서명을 Developer ID로 덮어쓴다. 키체인 프로필 방식은 최종 DMG를 공증하고 확인표를 첨부한다. Tauri가 중간 앱을 정리하므로 최종 DMG를 읽기 전용으로 마운트해 내부 앱의 서명과 Gatekeeper 평가까지 검사한다. `--check`는 사전조건 검사이며 실제 공증 성공을 보장하지 않는다. 이미 생성된 DMG의 공증·검증만 이어가려면 `--verify-existing`을 사용한다.

## 배포

- `docs/release-checklist.md`에 따라 검증 후 `scripts/package-artifacts.mjs`로 설치파일과 SHA256을 생성한다. 서명·공증 후에는 앱 내용을 수정하지 않는다.
- 두 아키텍처의 DMG를 `hdiutil verify`로 검사하고 인터넷에서 내려받은 설치파일의 첫 실행을 확인한다.
- 새 버전의 GitHub Release로 공개하고 홈페이지 다운로드 링크·서명 안내를 함께 갱신한다. 기존 0.2.1 파일을 그대로 덮어쓰지 않는다.
- 기존 GitHub Actions 빌드는 아직 임시 서명이다. 이 문서의 로컬 빌드 검증 후 인증서를 GitHub Secrets에 구성하는 자동 배포로 확장한다.
- Mac 개발자 가입·서명은 Windows 설치파일 서명을 해결하지 않는다.

참고: [Tauri Mac 서명·공증](https://tauri.app/distribute/sign/macos/)

2026-10-20: 로컬 `motungi-radio` 키체인 프로필이 없어 0.2.10은 기존 App Store Connect API 키로 공증했다. 두 DMG와 복사한 업데이트용 앱 모두 확인표·Developer ID·Gatekeeper 검증을 통과했다. 인증 재등록 없이 기존 비공개 키 파일을 사용했으며 개인 키는 배포물에 포함하지 않았다.
