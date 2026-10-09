# 소개 사이트

[공개 페이지](https://devsejong.github.io/motungi-radio-site/) · [저장소](https://github.com/devsejong/motungi-radio-site)

원본은 `site/`, 배포 체크아웃은 `/Users/sejong/Workspace/motungi-radio-site`다. GitHub Pages는 `main` 루트를 사용한다.

## 배포

```sh
cp site/index.html site/style.css site/app.js site/icon.svg site/README.md site/LICENSE site/.nojekyll /Users/sejong/Workspace/motungi-radio-site/
cp -R site/assets /Users/sejong/Workspace/motungi-radio-site/
git -C /Users/sejong/Workspace/motungi-radio-site add .
git -C /Users/sejong/Workspace/motungi-radio-site commit -m 'Update introduction site'
git -C /Users/sejong/Workspace/motungi-radio-site push
```

Pages 실행 성공, 공개 자산 일치, 데스크톱·모바일 화면을 확인한다. 소개 사이트의 Pages에는 앱 소스·설치파일·방송사 이미지·일시 스트림 URL을 올리지 않는다. 설치파일은 공개 저장소의 GitHub Releases에만 올린다. 방송 정보는 예시다.

[이전 배포 기록](archive/website-2026-10-09.md)

## 최신 확인

2026-10-09 · 소스 `e47ba85` · Pages 37931003039 성공. 소개를 한 문장으로 줄이고 중복·영문 장식 문구와 미사용 CSS 127개 규칙을 정리했다. 다운로드·공유 이미지 유지. 공개 HTML·CSS 일치, 320·1280px 다운로드 노출·넘침 없음, 테마·미니 전환 확인. 캡처: `artifacts/site-tidy/public-desktop.jpg`.
