# 설치·업데이트

정식 배포 전 시험 중입니다. 새 이름·앱 ID로 된 설치파일은 아직 생성하지 않았습니다. 이전 시험본은 별도 설정을 사용합니다.

| 환경 | 향후 설치파일 |
| --- | --- |
| macOS 13+ Apple Silicon | motungi-radio-버전-macos-arm64.dmg |
| macOS 13+ Intel | motungi-radio-버전-macos-x64.dmg |
| Windows 10/11 x64 | motungi-radio-버전-windows-x64.exe |

## 설치

- **Mac:** DMG를 열고 앱을 Applications로 복사합니다. 메뉴 막대 아이콘으로 플레이어를 엽니다.
- **Windows:** EXE를 실행하고 트레이 아이콘으로 플레이어를 엽니다. WebView2가 없으면 설치 중 인터넷 연결이 필요합니다.

시험본은 Mac 공증·Windows 코드 서명 전입니다. 출처를 확인하고 기기의 개별 앱 허용 절차를 사용하세요. 보안 기능 전체를 끄지 마세요.

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
