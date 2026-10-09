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

Pages 실행 성공, 공개 자산 일치, 데스크톱·모바일 화면을 확인한다. 소개 사이트에 앱 소스·설치파일·방송사 이미지·일시 스트림 URL을 올리지 않는다. 방송 정보는 예시다.

[이전 배포 기록](archive/website-2026-10-09.md)

## 최신 확인

2026-10-09 · 소스 `2b9f5d9` · Pages 37925920874 성공. 표시 이름을 모퉁이라디오로 통일하고 헤드라인·공유 제목을 브랜드에 맞췄다. 공개 HTML 일치, 320·380·1280px 넘침 없음 및 다크 모드 확인. 캡처: `artifacts/site-brand/`.
