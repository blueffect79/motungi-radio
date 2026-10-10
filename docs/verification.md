# 검증 기록과 직접 사용 시험

## 0.2.3 공개 시험판 — 2026-10-10

앱 소스 `5fd59318b3d4e0f01bff387f24b05fc9393cf196`. 프런트 53개·네이티브 48개·형식 6개 테스트 통과. KBS 6개 채널의 현재 썸네일을 실제 조회했다.

- Mac arm64·x64: 최종 DMG와 내부 앱의 버전·앱 ID·CPU·Developer ID·hardened runtime·공증 확인표·Gatekeeper 통과. 두 공증은 Accepted, issues 없음. arm64 `08f15043-3411-43db-8741-5e53eeb7c783`, x64 `7de13ba2-5c34-4225-b34b-5c09105c6fdc`.
- [Windows 빌드 38033325610](https://github.com/devsejong/motungi-radio/actions/runs/38033325610): 테스트·NSIS·내부 앱 AMD64·형식·해시 통과. 설치기는 미서명이며 실기기 설치·새 UI 동작은 미검증.
- [Linux 빌드 38033327182](https://github.com/devsejong/motungi-radio/actions/runs/38033327182), [설치본 실행 38033693221](https://github.com/devsejong/motungi-radio/actions/runs/38033693221): 두 설치 형식의 WebKit/IPC, 무음 시작, 미니 높이, 고정·35% 투명도 명령·해제, 트레이 설정·정지 이벤트, EBS 재생·정지 통과. 가상 화면·가상 음원 출력이며 사람의 청취·물리 트레이·로그인·절전·Wayland는 미검증. 실행 검사 소스는 `63bd71a`이며 앱 소스와 구분한다.
- 인터넷에서 익명으로 받은 5개 설치파일과 통합 체크섬의 SHA256 일치. Mac 다운로드 사본의 공증 확인표도 확인했다. Mac 실제 UI·청취·로그인·절전과 Intel 실행은 미검증.

[0.2.3 공개 릴리스](https://github.com/devsejong/motungi-radio/releases/tag/v0.2.3)

| 설치파일 | SHA256 |
| --- | --- |
| `motungi-radio-0.2.3-macos-arm64.dmg` | `c3d271ac39296cd273015839c082ec235ced1a35770e7f25bef9b83e24ce9809` |
| `motungi-radio-0.2.3-macos-x64.dmg` | `3d6d39516092aa0fac22da3a20c4cb99ac70628cf38b58ad8d2f6b7892927f44` |
| `motungi-radio-0.2.3-windows-x64.exe` | `fa68d02eb9b125ac31bd5e4aef31bba093bec85c97babf77feeb7c095425e53d` |
| `motungi-radio-0.2.3-linux-x64.deb` | `021e4b88886390188e9a12fea07fa130972c5b45e7ba0b09684a064c099fd5bb` |
| `motungi-radio-0.2.3-linux-x64.AppImage` | `943c3ab167a927d7447da6f95baafb74eea5ad5d9e1895195014828c93cae574` |

## Mac 0.2.2 서명 빌드 — 2026-10-10

앱 소스 `76dc1ab`, 공증·검증 스크립트 `46eac92`. Apple Silicon·Intel DMG 생성 완료. 최종 이미지 내부의 0.2.2 버전·앱 ID·대상 CPU·Developer ID Application 서명·hardened runtime와 서명 무결성을 확인했다. 프런트 50개·네이티브 46개·설치파일 형식 테스트 6개 통과.

Apple Silicon·Intel 모두 `Accepted`, 공증 로그의 issues 없음. 제출 ID: Apple Silicon `ea3e2011-481b-4d59-93f9-f7dc3b41f82a`, Intel `d5ad84cb-52a8-4a17-b703-884fb5adcae2`. 두 DMG의 공증 확인표, 체크섬, 서명과 최종 이미지 안의 앱 서명·Gatekeeper 평가가 모두 통과했다. Gatekeeper 원천은 `Notarized Developer ID`다. 실제 설치·청취·로그인·절전과 Intel Mac 실행은 별도 미검증이다.

[공개 릴리스](https://github.com/devsejong/motungi-radio/releases/tag/v0.2.2). 최종 파일 해시:

| 설치파일 | SHA256 |
| --- | --- |
| `motungi-radio-0.2.2-macos-arm64.dmg` | `f5a1013a4f2f939a60d678180092db948484830c1d023b5eecef9202d6117326` |
| `motungi-radio-0.2.2-macos-x64.dmg` | `9c873bdfe5bb8a87320fc08d995d13749deef8e6e19f612a1af2c1d1a4494dab` |

Windows 0.2.1과 Linux 시험판은 기존 파일을 유지한다.

## Linux 시험판 — 2026-10-10

소스 `165b9c0002c1d9142a8b905e2b5f3907a8abed99`. [빌드 37995950870](https://github.com/devsejong/motungi-radio/actions/runs/37995950870), [실행 37996892130](https://github.com/devsejong/motungi-radio/actions/runs/37996892130) 성공. 프런트 50개·네이티브 46개·형식 6개 통과. Ubuntu 22.04의 실제 WebKit/IPC, `.deb` 설치 및 AppImage 실행, 무음 시작, 미니 200–360px, 설정 640px·음량 100%, EBS FM playing 이벤트·5초 유지·정지 후 무재생을 확인했다. 가상 화면과 가상 음원 출력이며 사람의 청취, 물리 트레이·로그인·절전·Wayland는 미검증이다.

| 설치파일 | SHA256 |
| --- | --- |
| `motungi-radio-0.2.1-linux-x64.deb` | `fd8b8e74e42ebbfff3fc2e828ca1a4cceaefd1fc54a4578aaa1d6a8888bc1beb` |
| `motungi-radio-0.2.1-linux-x64.AppImage` | `0cfa1490d13039779f0e8fd72762da3a1a39b2bed713671eff529af956268ed8` |

[공개 다운로드](https://github.com/devsejong/motungi-radio/releases/tag/v0.2.1-linux.1). 내부 패키지명 `motungi-radio`, 앱 목록 이름 모퉁이 라디오, amd64 ELF와 다운로드 사본 해시를 확인했다.

## 공개 시험판 0.2.1 — 2026-10-09

[GitHub Releases](https://github.com/devsejong/motungi-radio/releases/tag/v0.2.1)에 Mac 2종·Windows x64 설치파일과 통합 SHA256SUMS.txt를 공개했다. 소스는 `a0bab4ea21869a072571f954872d39874f5c7b0c`, 빌드는 [Actions 37927624430](https://github.com/devsejong/motungi-radio/actions/runs/37927624430)이며 세 작업 모두 성공했다.

각 대상 프런트 50개·네이티브 46개·패키지 5개 테스트 통과(네이티브 실시간 검사 3개 제외). 실제 바이너리 CPU·설치파일 형식·SHA256 검사 통과. 두 DMG는 로컬에서 체크섬·내부 앱 ID·버전·CPU 및 ad-hoc 서명 무결성도 확인했다. 공개 파일 4개를 인증 없이 HTTP 200으로 내려받아 원본 해시와 대조했다.

| 공개 파일 | SHA256 |
| --- | --- |
| `motungi-radio-0.2.1-macos-arm64.dmg` | `500644000f40ceb65319b60e6857d662f7549db14f5534a585c2c69f249e125f` |
| `motungi-radio-0.2.1-macos-x64.dmg` | `2b9947b1686e1c2ff81b360b33e3e1885afac047322797b1518c523738e615ab` |
| `motungi-radio-0.2.1-windows-x64.exe` | `c8e5bc2ab1df5c5e1f378abc5ef5cc303c3b320979b4f279e0e0ace0a2821163` |

Mac 공증·Windows 코드 서명은 하지 않았다. 이번 설치본의 실기기 설치·청취, 로그인·절전·업데이트 시험은 미검증이다. 방송사 조건과 명시적인 제3자 앱 허가는 별개로 기록한다.

## 이전 0.2.1 설치파일 — 2026-10-09

빌드 소스는 `4b7a65f024829fe4a669c04b7497205cc7fb12c4` (`codex/player-redesign`)이다. 플레이어 제목·다음 프로그램, 중앙 재생/정지와 이전·다음 채널, 압정 고정·드래그, 날짜별 편성표, 기본 음량 100%, Retina 메뉴바 아래 배치 수정을 포함한다. 이후 문서 커밋은 빌드 소스가 아니다.

Mac arm64·x64 DMG는 로컬 릴리스 빌드와 DMG 체크섬 검사를 통과했다. 최종 DMG를 읽기 전용으로 마운트하여 내부 앱 버전 0.2.1, 실제 대상 CPU, `codesign --verify --deep --strict` 무결성 검사를 확인했다. ad-hoc 서명이며 Developer ID 서명·공증은 받지 않았다.

Windows x64 NSIS EXE는 [GitHub Actions 37914476217](https://github.com/devsejong/motungi-radio/actions/runs/37914476217)에서 같은 소스로 생성했다. 프런트 44개·네이티브 46개·패키지 5개 테스트, 실제 앱 AMD64 PE32+ 검사, EXE 형식·SHA256 검사와 artifact 업로드가 통과했다. 실시간 네이티브 테스트 3개는 제외됐다. 로컬 다운로드 사본의 EXE 형식과 SHA256도 확인했다. Windows는 코드 서명 전이다. 이 실행의 Mac 단계는 생략됐고 위 Mac 파일은 로컬 빌드 결과다.

| 대상 | 파일 | SHA256 |
| --- | --- | --- |
| macos-arm64 | `radiokorea-0.2.1-macos-arm64.dmg` | `2d5c30109f0c2e24258531989518fc04d373fff22c9f9d0be7f51f40ea990351` |
| macos-x64 | `radiokorea-0.2.1-macos-x64.dmg` | `43270ca9d542927ecfb42dec894837611d40de7929112bf093a93bb57419dd4e` |
| windows-x64 | `radiokorea-0.2.1-windows-x64.exe` | `6e8629a0cebf652672013134213aa90498b265eef362c989efeace9acf3c8913` |

파일은 `release-artifacts/0.2.1-4b7a65f/`의 대상별 폴더에 보관한다. 루트의 `build-provenance.json`과 `SHA256SUMS.txt`에 소스·빌드·체크섬을 기록했다. Windows [artifact 11608819910](https://github.com/devsejong/motungi-radio/actions/runs/37914476217/artifacts/11608819910)은 접근 권한이 필요하며 보관 기간은 14일이다. 소스 브랜치를 푸시했으며 공개 Releases 발행이나 저장소 공개 전환은 하지 않았다.

이번 0.2.1 DMG/EXE로 실제 설치·청취·업그레이드·로그인·절전 시험은 수행하지 않았다. 로컬 Mac에 설치된 0.2.0 앱은 `a9df600` 기준으로 이번 설치본과 같은 기능 코드를 포함하지만 버전 메타데이터와 설치파일은 다르다. Intel Mac 및 Windows 11 Intel의 실기기 시험은 사용자 확인이 남아 있다.

## 0.2.0 설치파일 — 2026-10-09

빌드 소스는 `162aa69393dbe7d879fc21e4f0753ac3d8a6f28c` (`codex/player-redesign`)이다. 아래 설치파일은 같은 소스의 UI 개편을 포함한다. 이후 문서 커밋은 설치파일의 빌드 소스가 아니다.

Mac arm64·x64 DMG는 로컬 릴리스 빌드, DMG 체크섬, 읽기 전용으로 마운트한 내부 앱의 0.2.0 버전·실제 CPU 아키텍처·서명 무결성 검사를 통과했다. Mac은 ad-hoc 서명이며 Developer ID 서명·공증은 받지 않았다.

Windows x64 NSIS EXE는 [GitHub Actions 37904725710](https://github.com/devsejong/motungi-radio/actions/runs/37904725710)에서 성공했다. 프런트 40개·네이티브 43개·패키지 5개 테스트, 실제 앱 AMD64 PE32+ 검사, EXE 형식·SHA256 검사와 artifact 업로드를 통과했다. 네이티브 실시간 테스트 3개는 기본 실행에서 제외됐다. 다운로드 사본의 SHA256도 일치한다. Windows는 코드 서명 전이다. 같은 실행의 Mac 단계는 생략됐으며 위 Mac 파일은 로컬 빌드 결과다.

| 대상 | 파일 | SHA256 |
| --- | --- | --- |
| macos-arm64 | `radiokorea-0.2.0-macos-arm64.dmg` | `176d5b4dfa1dcb7447a4e9bd45f6a68918a651c7b20088b17f236a29826d1e11` |
| macos-x64 | `radiokorea-0.2.0-macos-x64.dmg` | `debb1f18c0ddabf0e0eafedada97e781f1cd012d9112be010c3131997bfc5767` |
| windows-x64 | `radiokorea-0.2.0-windows-x64.exe` | `752f30ddd0739c25614532f09dd4d7b5dcca64ced08471e9f81d4f02e1a353ba` |

파일은 `release-artifacts/0.2.0-162aa69/`의 대상별 폴더에 보관한다. 루트의 `build-provenance.json`에 빌드 근거, `SHA256SUMS.txt`에 전체 체크섬을 기록했다. Windows artifact ID는 `11604147942`이며 GitHub 접근 권한이 필요하고 보관 기간은 14일이다. 공개 Releases 발행이나 저장소 공개 전환은 하지 않았다.

실제 설치·청취, 0.1.0에서의 설정 유지, 로그인 자동 실행·절전 복귀는 이 빌드에서 미검증이다. 아래 현재 버전 시험표에 Mac 및 Windows 11 Intel 결과를 별도로 기록한다.

## 0.1.0 이전 기록

기준일: 2026-10-09. 실제 설치·화면·청취 및 공개 배포 검증은 아직 완료되지 않았다. 앱 코드 `91ffeb4` 기준 자동 테스트 87개가 통과했다. Mac 잠금 상태로 화면 검증이 막힌 뒤 사용자가 “나중에 직접 화면 확인”을 선택했다. Windows 11 Intel 시험 PC는 연결되지 않았다. 아래 미검증 항목은 성공으로 판정하지 않는다.

## 0.1.0 이전 시험 판정

| 구분 | 확인된 근거 | 판정과 한계 |
| --- | --- | --- |
| 구현 | 메뉴 막대/트레이, 채널 전환, 프로그램 표시, 설정 저장, 자동 실행 설정 코드 연결 | 구현됨. OS에서의 실제 동작은 별도 확인 필요 |
| 프런트엔드 | `91ffeb4`에서 `npm run verify`: 테스트 43개 및 프로덕션 빌드, 종료 코드 0 | 자동 검증 통과. 지연된 TBN 설정 저장이 나중 채널 선택을 덮어쓰는 회귀 수정 포함 |
| 네이티브 | `91ffeb4`에서 `cargo test --locked --offline --manifest-path src-tauri/Cargo.toml`: 39개 통과, 실시간 원천 테스트 2개 제외, 종료 코드 0 | 자동 검증 통과. 실시간 테스트를 통과로 합산하지 않음 |
| 설치파일 검사 코드 | `91ffeb4`에서 `node --test scripts/check-binary-architecture.test.mjs`: 5개 통과, 종료 코드 0. `node scripts/check-package.mjs` 메타데이터 사전 검증 종료 코드 0 | 자동 검증 통과. 파일 검사 코드의 테스트이며 설치파일 자체의 성공 판정은 별도 |
| 스트림 원천 | 32개 채널의 실제 네이티브 resolver 및 HLS/미디어 바이트 응답 성공 | 네트워크 응답 확인. 소리 출력, 디코딩 지속성, 30분 재생을 확인한 것은 아님 |
| 프로그램 원천 | 18개 현재 프로그램 확인, 14개 확인 불가 | TBN 13개는 네이티브 TLS 요청 시간 초과, KBS 한민족은 응답 채널 불일치. 확인 불가를 정상 프로그램 정보로 간주하지 않음 |
| 0.1.0 설치파일 | `91ffeb4` 기준 Mac arm64·Intel DMG 생성·내부 바이너리·서명 일관성·해시 검증 통과. Windows x64 EXE도 [빌드 성공](https://github.com/devsejong/motungi-radio/actions/runs/37873884953), 실제 앱 AMD64 PE32+·설치파일 형식·해시 확인 | 파일별 결과는 아래 표에 기록. 실제 설치·화면·청취를 확인한 것은 아님. 이전 취소 실행은 성공 근거에서 제외 |
| 실기기 | 사용자 직접 확인 예정 | Mac 화면·청취 및 Windows 설치·실행 미검증 |
| 공개 배포 | [GitHub 저장소](https://github.com/devsejong/motungi-radio)는 비공개 검증 단계. MBC 재링크 고지 관련 공개 조건 미해결 | 공개 릴리스 완료 아님. 저장소·빌드 기록 접근에는 권한 필요 |

자동 테스트·원천 응답·파일 검사는 실제 설치·청취의 증거와 구분한다. 원천 확인 결과는 이후 방송사 변경으로 달라질 수 있다.

## 현재 버전 설치 후 10분 시험

자신의 CPU에 맞는 시험 파일과 SHA256SUMS.txt를 함께 확인한다. Mac은 DMG에서 앱을 Applications로 복사하고, Windows는 EXE를 실행해 현재 사용자 범위에 설치한다. Mac의 ad-hoc 서명은 Developer ID 공증이 아니며 Windows는 미서명 시험본이다. 출처와 해시를 확인하고 해당 앱에 대한 OS 실행 허용 여부를 판단한다. 전역 보안 기능을 끄지 않는다. 첫 시험 전에 스피커 또는 이어폰의 출력 상태를 확인한다.

| 순서 | 할 일 | 기대 결과 | 결과 |
| --- | --- | --- | --- |
| 1 | 설치 후 실행하고 메뉴 막대/트레이 아이콘 누르기 | 작은 창이 열리고 자동으로 소리가 나지 않음. 새 설정의 처음 음량은 100% | 미검증 |
| 2 | MBC·KBS·SBS 등 서로 다른 방송 선택 | 선택한 방송 하나만 들리고 현재 프로그램 또는 확인 불가 표시 | 미검증 |
| 3 | 여러 채널을 빠르게 선택한 뒤 정지 누르기 | 마지막 선택만 재생하고 정지 뒤 늦게 소리가 시작되지 않음 | 미검증 |
| 4 | 재생 중 창 숨기기, 다시 열기, 음량 바꾸기 | 숨겨도 재생 유지. 다시 열어 상태 확인과 음량 변경 가능 | 미검증 |
| 5 | 즐겨찾기 추가 후 앱에서 완전히 종료하고 재실행 | 즐겨찾기·음량·마지막 채널 복원, 재생은 시작하지 않음 | 미검증 |
| 6 | TBN 경인을 즐겨찾기에 등록 | 전체 목록에는 경인만 표시, 즐겨찾기 탭에 경인 표시 | 미검증 |
| 7 | 설정에서 라이트·다크·시스템 테마 및 음량 변경 | 테마 적용, 음량·음소거가 설정에서 명확히 표시 | 미검증 |
| 8 | 재생 중 미니 모드·편성표·설정 전환 | 재생 유지, 현재 채널 및 다음 편성 또는 공식 페이지 안내 확인 | 미검증 |

문제가 있으면 운영체제/CPU, 설치파일 이름과 버전, 채널, 한국시간, 수행한 동작, 화면 표시, 실제 들린 소리를 함께 기록한다. 토큰이 붙은 스트림 주소나 개인 정보는 공유하지 않는다.

## 상세 실기기 검증표

각 항목을 Mac과 Windows에서 따로 기록한다. `통과/실패/미검증`과 관찰 시각·내용을 적고, 실패 시 같은 시각의 공식 방송사 플레이어 상태를 함께 확인한다.

| 항목 | 시험 방법과 통과 기준 | Mac | Windows 11 Intel |
| --- | --- | --- | --- |
| 설치와 최초 실행 | 실제 배포 파일 설치, 보안 경고 및 첫 실행 경로 기록. 메뉴 막대/트레이에서 창 열기 | 미검증 | 미검증 |
| 30분 실제 청취 | 채널·시작/끝 한국시간 기록. 스피커로 30분 청취하며 중복 재생·예상치 않은 정지 없는지 확인. 대표 채널을 선택해 기록 | 미검증 | 미검증 |
| 전환 경쟁 | A→B→C 빠른 선택을 반복. 마지막 C만 들리고 A/B로 되돌아가지 않음 | 미검증 | 미검증 |
| 정지 취소 | 연결 중·재생 중 각각 정지. 20초 이상 기다려도 늦은 소리 없음. 다시 재생은 수동으로 가능 | 미검증 | 미검증 |
| 창 숨김과 종료 | 숨김/포커스 이동/닫기 후 재생 유지. 아이콘으로 복원. 명시적 앱 종료 후 소리와 프로세스 종료 | 미검증 | 미검증 |
| 음량 | 0·중간·100%에서 출력 반영, 드래그 중 끊김 없음. 재실행 후 저장값 복원 | 미검증 | 미검증 |
| 즐겨찾기와 마지막 채널 | 추가·제거 및 재실행 후 복원. 마지막 선택만 표시하고 무음으로 시작 | 미검증 | 미검증 |
| TBN 경인 | 경인만 한 줄 표시. 이전 버전의 다른 지역 즐겨찾기는 목록에 노출하지 않음 | 미검증 | 미검증 |
| 자동 실행 켜기 | 설정 켠 뒤 실제 로그아웃/로그인. 아이콘만 시작하고 창·소리 자동 시작 없음. OS 등록 상태와 앱 표시 일치 | 미검증 | 미검증 |
| 자동 실행 끄기 | 끈 뒤 실제 로그아웃/로그인 시 앱 시작하지 않음. OS에서 직접 상태를 바꾼 뒤 앱 표시도 실제 상태 반영 | 미검증 | 미검증 |
| 자동 실행 등록 실패 | 등록 실패가 발생하면 성공 안내 대신 오류가 표시되는지 확인. OS 실제 상태와 비교하고 설정 창을 다시 열어 재조회 | 미검증 | 미검증 |
| 절전 복귀 | 짧은 절전과 긴 절전을 각각 시험. 재생 상태에서 복귀 후 단일 재생 복구. 정지 상태에서는 복귀해도 무음 | 미검증 | 미검증 |
| 네트워크 복구 | 연결 해제 시 영구 로딩 없이 오류 표시. 재생 의도가 있으면 연결 복구 시 재시도. 정지 뒤 연결 복구해도 무음 | 미검증 | 미검증 |
| 중복 실행 | 재생 중 앱을 다시 실행. 프로세스/음원 중복 없이 기존 창 표시 | 미검증 | 미검증 |
| 프로그램 정확성 | 같은 시각 공식 편성표/현재 방송과 채널·제목·시작/종료 비교. 한국시간, 편성표 기준 표시, 시간 경계 전후 갱신 확인 | 미검증 | 미검증 |
| 정보 실패 독립성 | 확인 불가 채널에서도 음원 재생 가능. 정보 실패 시 이전 프로그램을 현재 방송처럼 계속 표시하지 않음 | 미검증 | 미검증 |
| 출력 장치 전환 | 스피커↔이어폰 전환 시 재생/볼륨 상태 확인 | 미검증 | 미검증 |
| 업데이트와 삭제 | 이전 버전 위 설치 후 설정 유지. 자동 실행 끈 뒤 제거하고 재로그인 시 잔여 자동 실행 없음 | 미검증 | 미검증 |

절전 복귀는 macOS의 `NSWorkspaceDidWake`와 Windows의 `PowerRegisterSuspendResume` 알림으로 처리하도록 구현했다. 타이머 간격으로 절전을 추정하던 방식은 제거했다. 실제 기기의 짧은·긴 절전 복귀와 네트워크 복구는 여전히 미검증이며, 구현이나 자동 테스트만으로 정상 복구를 보장하지 않는다.

## 채널별 실제 청취 기록

Mac과 Windows에서 아래 20개 채널을 각각 선택해 짧게 실제 소리를 듣고 결과를 기록한다. MBC 표준FM·FM4U·올댓뮤직도 각각 확인하며 한 채널 성공으로 나머지를 대신하지 않는다. 채널명과 실제 방송이 일치하는지 확인하고 `통과/실패`, 한국시간, 관찰 내용을 적는다. 위의 대표 채널 30분 시험은 이 채널별 확인과 별개다.

| 채널 ID | 방송 | Mac 실제 청취 | Windows 11 Intel 실제 청취 |
| --- | --- | --- | --- |
| mbc-sfm | MBC 표준FM | 미검증 | 미검증 |
| mbc-mfm | MBC FM4U | 미검증 | 미검증 |
| mbc-chm | MBC 올댓뮤직 | 미검증 | 미검증 |
| kbs-21 | KBS 1Radio | 미검증 | 미검증 |
| kbs-22 | KBS HappyFM | 미검증 | 미검증 |
| kbs-23 | KBS 사랑의소리 | 미검증 | 미검증 |
| kbs-24 | KBS ClassicFM | 미검증 | 미검증 |
| kbs-25 | KBS CoolFM | 미검증 | 미검증 |
| kbs-26 | KBS 한민족방송 | 미검증 | 미검증 |
| sbs-powerpc | SBS 파워FM | 미검증 | 미검증 |
| sbs-lovepc | SBS 러브FM | 미검증 | 미검증 |
| cpbc-seoul | cpbc 가톨릭평화방송 | 미검증 | 미검증 |
| ebs-fm | EBS FM | 미검증 | 미검증 |
| cbs-standard | CBS 표준FM | 미검증 | 미검증 |
| cbs-music | CBS 음악FM | 미검증 | 미검증 |
| cbs-joy4u | CBS JOY4U | 미검증 | 미검증 |
| bbs-seoul | BBS 불교방송 | 미검증 | 미검증 |
| febc-seoul | FEBC 서울극동방송 | 미검증 | 미검증 |
| wbs-seoul | WBS 원음방송 | 미검증 | 미검증 |
| tbn-gyeongin | TBN 경인 | 미검증 | 미검증 |

## 환경과 설치파일 증거

| 대상 | 목표 최소 환경 | 확보된 실기기 결과 |
| --- | --- | --- |
| Mac arm64 | macOS 13 이상 Apple Silicon | 개발 호스트 macOS 27.0.1. 실제 앱 화면·청취 미검증, macOS 13 미시험 |
| Mac x64 | macOS 13 이상 Intel | Intel 실기기와 최소 OS 모두 미시험. 크로스 빌드는 실행 검증을 대신하지 않음 |
| Windows x64 | Windows 10/11 x64 | 사용자 Windows 11 Intel PC는 존재하나 미연결·미시험. Windows 10 및 WebView2 미설치 환경 미시험 |

| 0.1.0 이전 시험 배포본 | 소스 commit | 파일명 / SHA256 | 빌드·형식 검증 | 실제 설치 |
| --- | --- | --- | --- | --- |
| Mac arm64 | `91ffeb4` | `macos-arm64/radiokorea-0.1.0-macos-arm64.dmg`<br>SHA256: `c9a09382a5fb0873e5cff6804684cf87d6ccfe48b6948188d5dfa53e2bdda5a3` | 빌드·DMG·arm64 바이너리·서명 일관성·해시 검사 종료 코드 0 | 미검증 |
| Mac x64 | `91ffeb4` | `macos-x64/radiokorea-0.1.0-macos-x64.dmg`<br>SHA256: `c7a25ff95a6025e488caa8ca6a60cea497c13ddddb0f9c54dce36358413f14cf` | 빌드·DMG·x86_64 바이너리·서명 일관성·해시 검사 종료 코드 0 | 미검증 |
| Windows x64 | `91ffeb4` | `radiokorea-0.1.0-windows-x64.exe` / `44b51e0d2f3f1767d3773002c8a0dbe9866e1ad3c654913fc3e8e45fcb168222` | Windows 테스트 43+39+5개·EXE 생성·실제 앱 AMD64 PE32+·설치파일 형식·해시 검사 통과. 다운로드 사본 SHA256도 동일 | 미검증 |

Mac 두 파일은 저장소의 `release-artifacts/0.1.0-91ffeb4/` 아래 각 하위 폴더에 보관한다. 각 대상에 `CI=true npm run tauri -- build --target aarch64-apple-darwin --bundles dmg` 또는 `--target x86_64-apple-darwin`을 실행해 종료 코드 0을 확인했다. `package-artifacts.mjs`의 실제 바이너리 아키텍처·DMG 헤더·SHA256 검사, `hdiutil verify`의 VALID 결과, 읽기 전용 마운트한 내부 앱의 `codesign --verify --deep --strict`, `file`의 arm64 또는 x86_64 확인, 마운트 해제가 모두 종료 코드 0이었다. 앱 UI를 실행하거나 소리를 청취한 검증은 아니다.

Mac은 ad-hoc 서명이며 Developer ID 서명/공증이 아니다. Windows는 코드 서명하지 않았다. 형식·해시 검증은 게시자 신원, 설치 성공, 실제 청취의 증거가 아니다.

공식 방송사 원천을 직접 사용하며 원천 응답 성공은 제3자 배포 허가가 아니다. MBC 공개 조건 해결, 직접 사용 결과와 최종 사용자 확인이 남아 있으므로 전체 검증 완료 또는 공개 배포 완료로 판정하지 않는다.

Windows 파일은 `release-artifacts/0.1.0-91ffeb4/windows-x64/`에 보관했다. GitHub 실행 37873884953의 Windows 작업은 성공이며, 같은 실행의 Mac 작업은 플랫폼 선택 때문에 생략됐다. Mac 두 파일은 별도 로컬 빌드 결과다. Windows 설치기 자체가 x86 형식이어도 내부 앱은 검증한 x64 대상이다.
