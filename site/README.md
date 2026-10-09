# 모퉁이 라디오 소개 사이트

Mac 메뉴 막대·Windows 트레이용 무료 앱 **모퉁이 라디오**의 GitHub Pages 소개 사이트입니다.

- 앱 버전: 0.2.1 (무료 시험판)
- 정적 HTML/CSS/JavaScript. 외부 폰트·분석·방송 재생 요청 없음
- 라이트/다크, 채널·미니 플레이어·편성표를 넘겨보는 인터페이스 예시
- 프로그램 제목과 시간은 예시. 방송사 프로그램 이미지·로고를 배포하지 않음
- 다운로드: GitHub Releases의 Mac arm64/x64·Windows x64 설치파일

앱 저장소의 `site/`에서 홈페이지를 관리합니다. 설치파일은 같은 저장소의 GitHub Releases에서 제공합니다.

로컬 확인: `python3 -m http.server 4173 --bind 127.0.0.1` 후 http://127.0.0.1:4173

사이트 코드는 MIT. 방송 콘텐츠·방송사 이름 등의 권리는 각 권리자에게 있습니다.

공유 이미지 원본은 `assets/share-card.html`입니다. 1200×630 화면을 JPEG로 저장하고 `og:image`·`twitter:image`의 파일명을 함께 갱신합니다. 외부 폰트·방송사 이미지 없이 제작합니다.
