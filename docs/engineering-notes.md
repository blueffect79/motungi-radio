# 구현 중 확인한 사항

- MBC 주소 조회가 rustls 환경에서 연결 재설정으로 실패했지만 macOS native TLS와 HTTP/1 조합에서는 성공했다. TLS 구현을 바꾸면 단위 테스트뿐 아니라 공식 API 및 미디어 조각 수신을 다시 확인한다. 전체 응답 URL은 기록하지 않는다.
- TBN 정보 조회 13개가 느리면 다른 방송사의 작업 슬롯도 점유할 수 있다. TBN 전용 제한을 공용 제한보다 먼저 얻어 다른 방송사의 조회가 진행되게 했다. 느린 방송사를 추가할 때 지연 원천과 빠른 원천의 동시 요청 테스트로 확인한다.
- 설정 저장 뒤 재생 여부를 판단하면 저장 대기 중 발생한 후행 선택을 덮는다. 입력 시점에 재생 의도를 적용하고 저장은 별도 순서로 처리한다. 저장을 일부러 지연한 UI 테스트가 이 문제를 재현한다.
- 백그라운드 타이머 지연은 절전과 같지 않다. 타이머 공백 추정 대신 macOS NSWorkspace의 전용 notification center와 Windows 전원 콜백을 사용한다. 이벤트 루프의 Resumed 이름만으로 전원 복귀라고 판단하지 않는다.
- CI=true로 Mac DMG를 만들면 Finder 배치용 AppleScript를 생략한다. 완료 뒤 중간 .app이 정리될 수 있으므로 최종 DMG를 읽기 전용 마운트하여 내부 앱을 검사한다. codesign 검증 성공도 Developer ID 공증을 뜻하지 않는다.
- Node 기본 테스트 러너의 .test.mjs를 Vitest가 수집하면 0 test suite 오류가 난다. 패키지 스크립트 테스트는 Node로, 화면 테스트는 Vitest로 분리하여 실행한다.

- macOS에서 tray-icon 사각형은 물리 픽셀이지만 Tao monitor_from_point는 CoreGraphics의 논리 좌표로 조회한다. Retina의 오른쪽 아이콘은 화면 밖으로 잘못 판정될 수 있다. 트레이 물리 좌표를 available_monitors의 물리 경계와 비교한 뒤 같은 단위로 창을 배치한다.

- Linux GTK에서는 `resizable=false`가 프로그램의 창 높이 변경도 막았다. Linux 창은 폭 380px을 고정하고 높이 변경을 허용한다. 미니 모드 전환 후 실제 WebKit 창 높이 200–360px을 검사한다.
- Debian의 Package 필드는 영문·숫자로 시작해야 한다. Linux 내부 productName은 motungi-radio, 앱 목록의 Name은 모퉁이 라디오로 분리한다.
