# GitHub Pages 소개 사이트

공개 주소: https://devsejong.github.io/radiokorea-site/

사이트 저장소: https://github.com/devsejong/radiokorea-site (공개)

앱 저장소 `devsejong/radiokorea`는 비공개로 유지한다. 소개 사이트는 앱 소스·설치파일·공식 일시 URL·방송사 이미지 없이 정적 HTML/CSS/JavaScript와 자체 SVG만 포함한다. 프로그램 제목·시간은 예시로 표시한다. 설치파일 공개는 기존 방송사 이용 조건과 실기기 검증 절차를 따른다. 현재 페이지는 0.2.1 시험본 안내이며 공개 다운로드를 제공하지 않는다.

## 수정과 배포

이 프로젝트의 `site/`에 사이트 원본을 보관한다. 공개 사이트 체크아웃은 `/Users/sejong/Workspace/radiokorea-site`다. 수정 후 아래 사이트 파일만 동기화하고 해당 사이트 저장소의 `main`에 푸시한다. 앱 프로젝트 전체를 복사하지 않는다.

```sh
cp site/index.html site/style.css site/app.js site/icon.svg site/README.md site/LICENSE site/.nojekyll /Users/sejong/Workspace/radiokorea-site/
git -C /Users/sejong/Workspace/radiokorea-site add .
git -C /Users/sejong/Workspace/radiokorea-site commit -m 'Update introduction site'
git -C /Users/sejong/Workspace/radiokorea-site push
```

GitHub Pages 소스는 `main` 브랜치의 루트이며 `.nojekyll`을 사용한다. HTTPS가 적용됐다. 외부 폰트·운영 분석·방송 요청은 없다. 페이지 테마 선택만 브라우저 로컬 저장소에 기록한다.

## 검증 — 2026-10-09

사이트 소스 `a0bc79a59bb35d5d88e0ab1cf6339a930a5f4191`, [Pages 실행 37917564465](https://github.com/devsejong/radiokorea-site/actions/runs/37917564465). 초기 실행은 후속 포맷 커밋 배포로 대체됐다. 최종 Pages build 상태 `built`, 공개 페이지 HTTP 200 확인.

- JavaScript 구문, HTML 내부 링크와 로컬 자산 경로 검사 통과
- 실제 공개 주소에서 스타일·스크립트 로드, 라이트/다크 테마, FAQ 열기와 설치 안내 이동 확인
- 데스크톱 렌더 너비 964px, 모바일 433px 및 로컬 작은 화면 355px에서 가로 넘침 없음. 브라우저 viewport 요청 390/320px의 실제 렌더 너비는 각각 433/355px로 관측됐으며 요청 값 자체를 실측치로 보고하지 않음
- 미니 모드 예시는 로컬에서 전체 채널 목록 숨김/복원과 버튼 상태 변경 확인
- 실제 공개 주소 콘솔 오류·경고 없음
- 캡처: `artifacts/site/github-pages-light.jpg`, `github-pages-dark.jpg`, `github-pages-mobile.jpg`

사이트 배포는 앱 공개 배포나 Windows 실기기 설치·청취 완료를 뜻하지 않는다.
