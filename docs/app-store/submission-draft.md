# Mac App Store 제출 초안 — 미제출

## 상품 정보

- 이름: 모퉁이 라디오
- 부제: 화면 한켠에서 듣는 한국 라디오
- 기본 언어: 한국어
- 제안 카테고리: 음악
- 가격: 무료
- 플랫폼: macOS 13 이상 (실제 스토어 빌드 대상 CPU별 검증 필요)
- 지원 URL: https://devsejong.github.io/motungi-radio/
- 개인정보처리방침 URL: https://devsejong.github.io/motungi-radio/privacy.html
- 키워드 후보: 라디오,한국,메뉴바,음악,실시간,편성표
- 연령 등급/수출 규정/배포 국가: App Store Connect 질문에 실제 기능과 권리 범위로 답한다. 자동 추정해 제출하지 않는다.

### 소개

화면 한켠에서, 좋아하는 한국 라디오를 한곳에.

모퉁이 라디오는 Mac 메뉴 막대에서 사용하는 작은 라디오입니다. 채널을 바꾸고 즐겨찾기를 모으며, 현재 프로그램과 다음 편성을 확인할 수 있습니다. 창을 고정하거나 투명도를 조절해 작업 중에도 편하게 사용할 수 있습니다.

계정 없이 사용할 수 있습니다. 인터넷 연결이 필요하며 방송과 프로그램 정보는 방송사의 제공 상황에 따라 달라질 수 있습니다. 녹음이나 방송 파일 다운로드는 제공하지 않습니다.

스토어 등록 채널과 이미지 권한이 확정되기 전에는 특정 방송사명이나 지원 채널 수를 마케팅 문구에 확정하지 않는다.

## 심사자 설명 초안 (English)

Motungi Radio is a macOS menu bar radio player. After launch, click the radio icon in the menu bar to open the player. The app intentionally does not appear in the Dock. Select a channel and press Play; audio never starts solely because the app launched.

No account or login is required. The app does not record or save radio audio. Schedule and artwork availability depends on the broadcaster. The Mac App Store build uses App Store updates and contains no external updater.

Content authorization evidence: NOT YET COMPLETE. Attach broadcaster-specific terms/permission evidence before submission. Do not submit this draft as an assertion that permissions have been granted.

Optional usage analytics: describe the final PostHog configuration only after the project and privacy disclosures are finalized. A US PostHog project is configured in the current source; collection is opt-in and disabled by default. The published privacy policy describes the configured data flow and a 90-day retention policy; automated deletion settings still require operational verification.

## 실제 스크린샷 준비

아래 장면은 최종 스토어 빌드에서 캡처한다. 기존 브라우저 프리뷰를 실제 설치판 증거로 대신하지 않는다.

1. 메뉴바 아이콘과 재생 중인 메인 플레이어
2. 채널 목록·즐겨찾기
3. 현재/다음 프로그램과 편성표
4. 창 고정·투명도, 배경에 민감한 사용자 창이 없는 상태
5. 설정의 App Store 업데이트 안내와 앱 정보

모든 이미지·로고가 사용 허가 범위인지 확인한다. 심사용 이미지 규격은 업로드 시 App Store Connect 요구사항으로 확인한다.

## 제출을 막는 항목

- App Store 배포/Installer 인증서와 앱 프로비저닝 프로파일 미확인
- 방송 스트리밍·편성표·이미지 이용 권한 자료 미완성
- 샌드박스 실제 설치·청취·재로그인·절전 복귀 미검증
- 로그인 자동 실행 어댑터는 구현 중이며 UI 활성화 전 실제 등록/해제 검증 필요
- PostHog US 프로젝트 연결 완료, 보관 운영 정책 90일·고지 게시 완료, 자동 삭제 설정 미확인
- 개인정보처리방침 게시 완료, 문의 devsejong@gmail.com. App Privacy 답변 및 통계 보관/삭제 설정 확인 필요
- 직접 배포판 설정 이전 UI 미구현, 자동 이전 없음

확인 근거: https://tauri.app/distribute/app-store/ · https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/app-store/app-privacy-details/
