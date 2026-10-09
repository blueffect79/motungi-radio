# 빌드 보조 스크립트

도구체인 선택과 설치파일 검사를 소유한다. 방송사 요청·사용자 설정·공개 발행은 담당하지 않는다.

NSIS 설치기 자체의 CPU와 내부 앱 CPU는 다를 수 있다. 실제 motungi-radio.exe가 AMD64 PE32+인지 확인하고, Mac은 대상별 thin Mach-O CPU를 검사한다. 빈 출력 폴더에만 복사하고 복사 후 SHA256을 다시 계산한다.

검증은 node --test scripts/check-binary-architecture.test.mjs로 한다. 잘린 파일·잘못된 CPU·범위 밖 PE offset을 포함하며 실제 대상 설치본 검사도 별도 실행한다.
