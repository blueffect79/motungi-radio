# 공식 채널 연결 검증

2026-10-09 KST. 카탈로그 v1: 32채널, 31채널 공식 원천과 HTTPS 연결 확인, FEBC 서울 1채널 연결 원천 미확인. 일반 지역방송 제외, TBN 13지역만 예외. `streamKey: unavailable` 항목은 resolver가 명시적인 unavailable 오류를 반환한다. 연결 확인은 실제 청취 품질이나 제3자 배포 허가 확인을 의미하지 않는다.

| 방송사 | 카탈로그 | 공식 원천·확인 결과 |
|---|---|---|
| MBC | 서울 표준FM, FM4U, 올댓뮤직 | [mini](https://mini.imbc.com/), [공식 webapp JS](https://miniwebapp.imbc.com/static/js/main.6c55a947.js)의 sminiplay.imbc.com/aacplay.ashx. sfm/mfm/chm + protocol=M3U8 + agent=webapp. 고정 callback `__aacplay` JSONP를 JSON 데이터로만 파싱. API·HLS·오디오조각200, 실제 Rust resolver 3개 성공. |
| KBS | 1·2·3라디오, 1·2FM, 한민족 | [공식 라디오](https://radio.kbs.co.kr/), cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/21~26의 channel_item.service_url. API·HLS·조각200. 한민족 CDN은 hanminjokradio.gscdn.kbs.co.kr. World/인터넷 부가채널은 연결·카탈로그 별도 미확인으로 이번 등록 제외. |
| SBS | 파워FM, 러브FM | [공식 라디오](https://www.sbs.co.kr/radio/), apis.sbs.co.kr/play-api/1.0/livestream/{powerpc/powerfm,lovepc/lovefm}?protocol=hls. 공식 응답의 radiolive.sbs.co.kr HTTP 주소를 검증된 동일 호스트 HTTPS로 변경, 서명은 그대로 유지. HLS·조각200. 고릴라 부가 음악채널은 이번 연결 미확인. |
| EBS | FM | [공식 온에어](https://www.ebs.co.kr/onair?channelCodeString=radio) 현재 HTML src의 liveotu.ebs.co.kr/fm/ 서명 URL을 매번 읽음. JS 실행 없이 허용된 URL 문자열만 추출. HLS·조각200. 반디 외국어는 별도 확인 전 등록 제외. |
| CBS | 표준FM, 음악FM, JOY4U | [공식 onair](https://cbs.co.kr/onair/fm)의 onairUrl. 현재 m-aac.cbs.co.kr/mweb_{cbs981,cbs939,cbscmc}/_definst_/{key}.stream/playlist.m3u8. 3개 HLS·조각200. www.cbs.co.kr 홈페이지 연결종료와 구 aac.cbs.co.kr DNS 실패는 현재 스트림 실패가 아님. |
| BBS | 서울 불교방송 | [공식 온에어](https://www.bbs.or.kr/HOME2/?ACT=ONAIR&pType=RADIO)의 source src, bbslive.clouducs.com/bbsradio-mlive/radio.stream/playlist.m3u8. HLS·AAC 조각200. 구 bbsradio-live/livestream 경로는 실패. |
| cpbc | 서울 가톨릭평화방송 | [공식](https://www.cpbc.co.kr/), [공식 API](https://apis.cpbc.co.kr/play-api/2.0/onair/channel/radio)의 onair.source.mediasource.mediaurl. cdn-radio-seoul.cpbc.co.kr의 동일 경로를 HTTPS 사용. HLS·조각200. |
| FEBC | 서울극동방송(미확인) | [공식 서울](https://seoul.febc.net/) 현재 채널 확인. 과거 후보 mlive2.febc.net/live/seoulfm/playlist.m3u8는 HTTPS HLS200이지만 현재 공식 플레이어와 연결 관계를 확인하지 못함. 접근 불가라고 단정하지 않으며 확인 전 unavailable 반환. |
| WBS | 원음방송 서울 | [공식 온에어](https://wbsi.kr/onair_radio.php)의 audio data-stream=https://wbsradio.kr/wbs-seoul. HTTP200 audio/mpeg, 실제 MPEG 데이터 수신 확인. 무한 라이브 다운로드를 하지 않고 첫 chunk까지만 검증. 구 www.wbs.co.kr TLS 오류는 현 서비스 실패가 아님. |
| TBN | 부산·전남광주·대구·대전·경인·강원·전북·울산·경남·경북·제주·충북·충남 | [공식 플레이어](https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=1)의 현재 hls.loadSource www.tbn.it.kr/{지역}/myStream/playlist.m3u8. 공식13지역 목록과 onload 키 대조. 전13지역 HLS·조각200. 2026-05-04 URL변경 주석 확인. |

## 네트워크·계약

- `list_stations() -> Result<Catalog, AppError>`, `resolve_stream(&str) -> Result<ResolvedStream, AppError>`; Tauri 경계는 `ApiResult::from(...)`으로 `{ok:true,data}` 또는 `{ok:false,error}` 반환. TS 계약과 camelCase 필드 동일.
- 방송사별 정확한 호스트 allowlist, HTTPS/443, 사용자정보 및 fragment 금지. API/HLS 리다이렉트도 같은 방송사 allowlist로 검증하며 최대3번. WBS는 리다이렉트 거부.
- 각 HTTP 요청 전체10초 제한, 유한 API/HLS 응답256KiB 제한. WBS 라이브는 첫 chunk 후 종료. 사용자에게 원본 reqwest 오류·서명URL을 노출하지 않는다.
- 방송사가 발행한 서명/토큰을 수정하거나 생성하지 않는다. MBC 토큰의 정확한 만료시간은 확인하지 않았으며 매 재생 시 신규 조회한다. resolved URL은 메모리에서만 사용, 카탈로그·설정·로그에 저장하지 않는다.
- 실제 macOS reqwest rustls는 MBC에서 ConnectionReset 발생. HTTP/1 강제·UA 변경만으로 해결되지 않음. **native-tls feature + use_native_tls()**로 인증서 검증을 유지하며 MBC 포함31개 Rust resolver 성공. 부모 Cargo.toml에 native-tls 필요.
- 최종 오디오 재생기의 HLS 후속 요청은 WKWebView 엔진이 수행한다. resolver는 최초 HLS까지만 런타임 검증하고, 개발 probe는 하위목록·첫 조각까지 확인한다.

## 검증 기록

- RED: 기능 작성 전 `rejects_foreign_host` 테스트 추가. `cargo test --offline --lib radio` exit101, `validate_url` 미구현(E0425) 확인.
- GREEN: 호스트 위조/HTTP/포트/자격정보, 악성·손상 JSONP, 중복ID, 계약 envelope, EBS 문자열, 응답 크기 경계, 실제 로컬 timeout 테스트.
- `cargo test --features reqwest/native-tls --lib radio::tests::live_resolver -- --ignored` 실제31개 resolver 성공 exit0. 이 검사는 외부 네트워크가 필요하며 기본 테스트에서는 ignored.
- `python3 scripts/live-stations-check.py`: 공식 응답→HLS→하위목록→첫 오디오 조각만 bounded probe, ID/결과만 출력. FEBC는 UNVERIFIED. URL과 토큰은 출력·저장하지 않음.
- `npm run build` exit0. 최종 전체 테스트 결과는 작업 완료 보고 참조.
- sandbox에서 소켓 listen/외부네트워크가 막힐 수 있다. 로컬 timeout 테스트와 live 검사는 권한 있는 실행 환경에서 수행. 네트워크 sandbox 실패를 방송사 장애로 해석하지 않는다.

## 프로그램 정보 원천 단서

- cpbc 공식 API `onair.info.title` 및 정보 필드.
- EBS 공식 페이지 `/onair/cururentOnair.json` 호출(철자 원문 그대로), 편성표 `/schedule`.
- CBS `https://cbs.co.kr/schedule/all/ajax` GET JSON: tv/fm/musicfm/joy4u.
- WBS 공식 온에어 HTML `.tit` 제목과 방송시간 문자열.
- MBC mini 공식 JS의 편성/현재 방송 호출을 별도 확인할 것. 임의 프로그램 제목을 만들지 않는다.

MBC 재링크 관련 고지가 존재하며 앱 재배포·외부 플레이어 사용에 대한 명시적 허용은 별도 확인 필요하다. 이번 결과는 공식 공개 연결의 기술적 검증이며 배포 허가의 증명이 아니다. 개인 중개 서버나 인증 우회는 사용하지 않았다.
