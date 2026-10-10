# 설치·업데이트

[홈페이지](https://devsejong.github.io/motungi-radio/) 또는 [GitHub Releases](https://github.com/devsejong/motungi-radio/releases/tag/v0.2.4)에서 무료 시험판을 받습니다. GitHub 로그인은 필요 없습니다. 이전 한국 라디오 시험본과는 별도 설정을 사용합니다.

| 환경 | 설치파일 |
| --- | --- |
| macOS 13+ Apple Silicon | motungi-radio-0.2.4-macos-arm64.dmg |
| macOS 13+ Intel | motungi-radio-0.2.4-macos-x64.dmg |
| Windows 10/11 x64 | motungi-radio-0.2.4-windows-x64.exe |

## 설치

- **Mac:** DMG를 열고 앱을 Applications로 복사합니다. 메뉴 막대 아이콘으로 플레이어를 엽니다.
- **Windows:** EXE를 실행하고 트레이 아이콘으로 플레이어를 엽니다. WebView2가 없으면 설치 중 인터넷 연결이 필요합니다.

Mac 0.2.4은 Developer ID 서명·Apple 공증을 완료했습니다. Windows 0.2.4은 아직 코드 서명 전이며 SmartScreen 경고가 나타날 수 있습니다.

## 파일 확인

동봉된 SHA256SUMS.txt와 비교합니다.

```sh
# macOS
shasum -a 256 파일이름.dmg
```

```powershell
# Windows
Get-FileHash .\파일이름.exe -Algorithm SHA256
```

## 업데이트·삭제

앱을 완전히 종료한 뒤 Mac은 앱을 교체하고 Windows는 새 설치기를 실행합니다. 자동 업데이트는 지원하지 않습니다.

삭제 전 로그인 시 실행을 끕니다. Mac은 앱을 휴지통으로, Windows는 설정 → 설치된 앱에서 제거합니다. 설정 파일은 남을 수 있습니다.

방송이 안 나오면 인터넷 연결과 방송사 공식 플레이어를 확인하세요. [시험 결과](verification.md)

## Linux 시험판

[Linux 설치파일](https://github.com/devsejong/motungi-radio/releases/tag/v0.2.4)

Ubuntu 22.04 이상·Linux Mint 21 이상, Intel/AMD 64비트부터 제공합니다. `.deb`는 패키지 관리자로 설치하고, `.AppImage`는 실행 권한을 부여한 뒤 실행합니다. 다른 배포판·Wayland는 미검증입니다.

```sh
sudo apt install ./motungi-radio-0.2.4-linux-x64.deb
# 또는
chmod +x motungi-radio-0.2.4-linux-x64.AppImage
./motungi-radio-0.2.4-linux-x64.AppImage
```

Linux에서는 작업 표시줄의 일반 창으로 사용합니다. 트레이가 있으면 메뉴의 ‘화면 열기’로 복원할 수 있습니다. 창은 외부 클릭으로 숨겨지지 않으며 닫기 시 최소화합니다. GNOME에서 트레이 확장이 없어도 작업 표시줄로 돌아올 수 있습니다. 절전 복귀는 systemd-logind 알림을 사용합니다. 실제 청취·로그인·절전과 데스크톱별 트레이 동작은 별도 시험이 필요합니다.
