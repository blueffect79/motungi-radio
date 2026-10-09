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

2026-10-09 · 소스 `b943083` · Pages 37926891628 성공. 아래 설명을 삭제하고 Mac·Windows 다운로드 버튼을 첫 화면에 배치했다. 설치파일은 아직 공개되지 않아 준비 중으로 표시한다. 공개 HTML·CSS 일치, 320·1280px 버튼 노출과 넘침 없음 및 다크 모드 확인. 캡처: `artifacts/site-downloads/`.
