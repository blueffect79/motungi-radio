# 모퉁이 라디오

한국 채널을 방송사 구분 없이 듣는 무료 PC 앱이다. Tauri·TypeScript·Rust로 Mac 메뉴 막대와 Windows 트레이의 작은 창을 공유한다. 계정·운영 서버 없이 공식 방송사에 직접 연결한다.

```text
radiokorea/
├── AGENTS.md → 프로젝트 작업 기준
├── CLAUDE.md → 같은 작업 기준
├── docs/
│   ├── architecture.md → 경계와 데이터 흐름
│   ├── business-rules.md → 청취와 정보 표시 규칙
│   ├── security.md → 외부 데이터·권한·일시 URL
│   ├── standards.md → 변경과 검증 기준
│   ├── engineering-notes.md → 재현된 함정과 대응
│   ├── operations.md → 실행·빌드·시험 절차
│   ├── contracts.md → 외부 제공 범위
│   ├── install.md → 사용자 설치·업데이트
│   ├── station-support.md → 방송 원천 확인
│   ├── verification.md → 설치파일 근거·직접 시험
│   ├── release-checklist.md → 배포 전 검사
│   └── tracking/
│       ├── status.md → 구현과 미검증 범위
│       ├── findings.md → 외부 조건과 남은 문제
│       └── decisions/
│           ├── index.md → 결정 목록
│           └── 0001-desktop.md → 두 OS 공동 구현의 선택
├── scripts/AGENTS.md → 설치파일과 도구체인 검사
├── src/
│   ├── AGENTS.md → 화면 조합과 접근성
│   ├── shared/AGENTS.md → 프런트 공용 계약
│   └── features/
│       ├── channels/AGENTS.md → TBN·즐겨찾기 선택
│       ├── player/AGENTS.md → 단일 재생기·취소
│       ├── programs/AGENTS.md → 현재 정보 갱신
│       └── settings/AGENTS.md → 설정 변경 순서
└── src-tauri/
    ├── AGENTS.md → 네이티브 명령과 OS 경계
    └── src/
        ├── radio/AGENTS.md → 공식 주소 해석
        ├── programs/AGENTS.md → 시간 구간·캐시
        ├── playback/AGENTS.md → 요청 취소 순서
        ├── settings/AGENTS.md → 파일 저장·복구
        ├── desktop/AGENTS.md → 무음 시작·OS 등록
        └── tray/AGENTS.md → 창 배치·숨김·종료
```

## 우선 지킬 조건

- 마지막 재생 선택을 지키고, 실행·로그인만으로 오디오를 시작하지 않는다.
- 정보 실패와 창 숨김은 정상 청취를 끊지 않는다.
- 공식 일시 URL을 영구 저장하거나 인증·지역 제한을 우회하지 않는다.
- 기술 접속·실제 청취·공개 허가는 각각 근거를 기록한다.

## 변경 전 확인

기본적으로 standards·engineering-notes와 해당 모듈 지침을 읽는다. 방송사 변경 전에는 security와 station-support의 정확한 원천을, 저장 변경 전에는 미래 버전 보호를, OS 변경 전에는 실제 설치·로그인·절전의 미검증 범위를 확인한다. 현재 진행 상태는 tracking/status에서 확인한다.

## 문제 처리

사용자 정지 뒤 자동 재생, 다른 채널로 뒤늦게 전환, 일시 URL 노출, 설정 파일 손실, 허가되지 않은 공개가 발생하면 즉시 사용자에게 알린다. 해결 가능한 코드 문제는 수정·회귀 검증하고, 외부 조건 등 당장 해결할 수 없는 문제는 이유와 다음 조치를 tracking/findings에 기록한다.
