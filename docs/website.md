# 소개 사이트

[공개 페이지](https://devsejong.github.io/motungi-radio-site/) · [저장소](https://github.com/devsejong/motungi-radio-site)

원본은 `site/`, 배포 체크아웃은 `/Users/sejong/Workspace/motungi-radio-site`다. GitHub Pages는 `main` 루트를 사용한다.

## 배포

```sh
cp site/index.html site/style.css site/app.js site/icon.svg site/README.md site/LICENSE site/.nojekyll /Users/sejong/Workspace/motungi-radio-site/
git -C /Users/sejong/Workspace/motungi-radio-site add .
git -C /Users/sejong/Workspace/motungi-radio-site commit -m 'Update introduction site'
git -C /Users/sejong/Workspace/motungi-radio-site push
```

Pages 실행 성공, 공개 자산 일치, 데스크톱·모바일 화면을 확인한다. 소개 사이트의 Pages에는 앱 소스·설치파일·방송사 이미지·일시 스트림 URL을 올리지 않는다. 설치파일은 공개 저장소의 GitHub Releases에만 올린다. 방송 정보는 예시다.

[이전 배포 기록](archive/website-2026-10-09.md)

## 최신 확인

2026-10-09 · 소스 `1797fad` · Pages 37929942183 성공. GitHub Releases v0.2.1의 Mac 2종·Windows 설치파일에 다운로드 버튼을 연결했다. 공개 HTML·CSS 일치, 인증 없는 파일 다운로드·SHA256 일치, 320·1280px 화면 확인. 캡처: `artifacts/public-release/0.2.1/homepage.jpg`.
