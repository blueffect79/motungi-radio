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

2026-10-09 · 소스 `d56c83a` · Pages 37930642765 성공. 1200×630 JPEG 공유 이미지와 Open Graph·X 카드의 제목·설명·대체 설명을 추가했다. 공개 HTML·이미지 HTTP 200 및 원본 일치, image/jpeg 확인. 서비스별 실제 공유 결과·기존 미리보기 캐시 갱신은 미확인이다. 이미지 원본: `site/assets/share-card.html`.
