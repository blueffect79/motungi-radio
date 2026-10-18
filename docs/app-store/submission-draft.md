# Mac App Store 제출 기록 — 0.2.9 심사 대기

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

Content rights were confirmed by the operator. Independent broadcaster-specific permission documents have not been collected.

Optional usage analytics: describe the final PostHog configuration only after the project and privacy disclosures are finalized. A US PostHog project is configured in the current source; collection is opt-in and disabled by default. The published privacy policy describes the configured data flow and a 90-day retention policy; automated deletion settings still require operational verification.

## 실제 스크린샷 준비

아래 장면은 최종 스토어 빌드에서 캡처한다. 기존 브라우저 프리뷰를 실제 설치판 증거로 대신하지 않는다.

1. 메뉴바 아이콘과 재생 중인 메인 플레이어
2. 채널 목록·즐겨찾기
3. 현재/다음 프로그램과 편성표
4. 창 고정·투명도, 배경에 민감한 사용자 창이 없는 상태
5. 설정의 App Store 업데이트 안내와 앱 정보

모든 이미지·로고가 사용 허가 범위인지 확인한다. 심사용 이미지 규격은 업로드 시 App Store Connect 요구사항으로 확인한다.

## 후속 운영 검증

- 배포/Installer 인증서와 프로파일 발급 및 서명 pkg 내부 검사 완료(2026-10-18). Apple VALID 및 심사 제출 확인 완료
- 방송 스트리밍·편성표·이미지 이용 권한 자료 미완성
- 샌드박스 실제 설치·청취·재로그인·절전 복귀 미검증
- 로그인 자동 실행 어댑터는 구현 중이며 UI 활성화 전 실제 등록/해제 검증 필요
- PostHog US 프로젝트 연결 완료, 보관 운영 정책 90일·고지 게시 완료, 자동 삭제 설정 미확인
- 개인정보처리방침 게시 완료, 문의 devsejong@gmail.com. App Privacy 게시 완료, 통계 보관/삭제 운영 설정 확인 필요
- 직접 배포판 설정 이전 UI 미구현, 자동 이전 없음

확인 근거: https://tauri.app/distribute/app-store/ · https://developer.apple.com/app-store/review/guidelines/ · https://developer.apple.com/app-store/app-privacy-details/

## 2026-10-18 준비 결과

App Store Connect 앱 ID `6824204878`, Bundle ID `io.github.devsejong.motungiradio`, 버전 0.2.9. 한국어 소개·음악 카테고리·개인정보처리방침·심사 연락처·수동 출시를 저장했다. 전화번호는 사용자가 직접 입력했으며 저장소에 기록하지 않는다.

사용자 승인으로 Mac App Distribution·Mac Installer Distribution 인증서와 Mac App Store 프로파일을 발급했다(만료 2027-10-18). 개인키는 저장소 밖 비공개 폴더와 키체인에만 보관한다. 제품 소스 `3ba726f` Universal 0.2.9의 서명 pkg 내부 앱·CPU·버전·ID·샌드박스를 재검증했다. 업로드·심사 제출·공개 전이다.

## 스토어 심사 제출 — 2026-10-18 21:50 KST

- Windows 제품 `9P5RR68464SX`, 제출 `1152921505702161989`: **In certification**, 공개 전. 실제 MBC FM4U 플레이어 스크린샷 등록.
- Mac 앱 `6824204878`, 0.2.9: **심사 대기 중**, 제출 `4d5bb705-2b91-4e9c-99cb-ccb66e557709`. 실제 설치 앱의 EBS FM 재생 화면을 1280×800 배경에 배치하여 등록했다. 동의 화면은 사용하지 않았다.
- Mac 빌드 `217c8910-97d4-4abe-a4e3-83378e022a8a`: VALID / APP_STORE_ELIGIBLE. 제품 소스 `3ba726f`, Universal arm64·x86_64. 개인정보 레이블 게시, 무료 가격·175개 지역·수동 출시 저장. 글로벌 13+, 한국 12+.
- 콘텐츠 권한은 운영자의 “외부 사용 가능, 권한 문제 없음” 확인을 근거로 입력했다. 개별 방송사 허가서를 독립 수집한 것은 아니다. EU DSA·중국 콘텐츠 규제 관련 추가 증빙 요구 여부는 심사 및 공개 단계에서 확인한다.
- 매일 한국 시간 오전 10시 `automation-2`가 두 스토어 심사 상태를 확인하고 승인 시 공개한다. 변경 없는 대기는 반복 알림하지 않는다. 아직 스토어 공개·스토어 설치 검증은 완료하지 않았다.
