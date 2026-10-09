# 변경과 검증 기준

- 방송사별 파싱과 주소 허용 검사는 네이티브 어댑터에 둔다. 화면에 방송사별 네트워크 우회 코드를 넣으면 경계 위반이다.
- 공용 타입 변경은 TypeScript 소비자와 Rust 직렬화·명령 등록을 함께 검사한다. 한쪽 모의 테스트만 통과한 것을 실제 IPC 통과로 보고하지 않는다.
- 새 재생 경로도 기존 단일 제어기를 사용한다. 화면 이벤트에서 별도 오디오 요소를 만들거나 저장 완료 뒤 오래된 재생 결정을 실행하면 위반이다.
- 의존성은 package-lock.json과 Cargo.lock을 함께 보존한다. CI에서 npm ci와 cargo --locked를 사용하며 생성된 설치파일·로컬 도구체인은 소스에 추가하지 않는다.
- 코드 변경 후 npm run verify와 cargo test --locked --manifest-path src-tauri/Cargo.toml을 실행한다. 패키지 변경은 node --test scripts/check-binary-architecture.test.mjs와 node scripts/check-package.mjs도 검사한다. 실행하지 못한 검사는 미검증으로 남긴다.
- 기능 커밋과 설치파일의 소스 commit을 연결한다. 이후 문서만 바뀐 경우에도 빌드에 실제 사용한 commit을 바꾸어 적지 않는다.
- 설치파일 공개 전 대상별 형식·실제 앱 아키텍처·해시와 실기기 결과를 확인한다. 미서명 파일을 서명·공증 완료라고 부르거나 빌드 성공을 청취 성공으로 합산하면 위반이다.
