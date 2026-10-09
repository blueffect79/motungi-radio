# 네이티브 호스트

명령 등록·방송사 네트워크·로컬 파일·OS 기능을 소유한다. 미디어 재생 주체나 화면 DOM은 이 영역에 만들지 않는다.

명령의 camelCase 입력과 Rust serde 출력을 공용 프런트 계약과 함께 바꾼다. 비동기 State 수명 대신 AppHandle에서 관리 상태를 가져오는 기존 패턴을 따른다. 전원 콜백은 창 가시성과 무관하게 유지하고 Exit에서 해제한다.

검증: cargo test --locked --manifest-path src-tauri/Cargo.toml. OS별 cfg 코드는 해당 대상 빌드로 검사한다. 네이티브 컴파일 성공을 전원·로그인·실제 청취 성공으로 부르지 않는다.
