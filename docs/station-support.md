# 공식 채널 연결 검증

2026-10-09 KST. 카탈로그 v1: 32채널 모두 공식 원천과 HTTPS 연결 확인. 일반 지역방송 제외, TBN 13지역만 예외. `streamKey: unavailable` 항목은 resolver가 명시적인 unavailable 오류를 반환한다. 연결 확인은 실제 청취 품질이나 제3자 배포 허가 확인을 의미하지 않는다.

| 방송사 | 카탈로그 | 공식 원천·확인 결과 |
|---|---|---|
| MBC | 서울 표준FM, FM4U, 올댓뮤직 | [mini](https://mini.imbc.com/), [공식 webapp JS](https://miniwebapp.imbc.com/static/js/main.6c55a947.js)의 sminiplay.imbc.com/aacplay.ashx. sfm/mfm/chm + protocol=M3U8 + agent=webapp. 고정 callback `__aacplay` JSONP를 JSON 데이터로만 파싱. API·HLS·오디오조각200, 실제 Rust resolver 3개 성공. |
| KBS | 1Radio, HappyFM, 사랑의소리, ClassicFM, CoolFM, 한민족방송 | [공식 라디오](https://radio.kbs.co.kr/), cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/21~26의 channel_item.service_url. API·HLS·조각200. 한민족 CDN은 hanminjokradio.gscdn.kbs.co.kr. World/인터넷 부가채널은 연결·카탈로그 별도 미확인으로 이번 등록 제외. |
| SBS | 파워FM, 러브FM | [공식 라디오](https://www.sbs.co.kr/radio/), apis.sbs.co.kr/play-api/1.0/livestream/{powerpc/powerfm,lovepc/lovefm}?protocol=hls&ssl=Y. ssl=Y 옵션으로 공식 서버가 HTTPS URL을 직접 반환하며 응답 URL을 그대로 사용. HLS·조각200. 고릴라 부가 음악채널은 이번 연결 미확인. |
| EBS | FM | [공식 온에어](https://www.ebs.co.kr/onair?channelCodeString=radio) 현재 HTML src의 liveotu.ebs.co.kr/fm/ 서명 URL을 매번 읽음. JS 실행 없이 허용된 URL 문자열만 추출. HLS·조각200. 반디 외국어는 별도 확인 전 등록 제외. |
| CBS | 표준FM, 음악FM, JOY4U | [공식 onair](https://cbs.co.kr/onair/fm)의 onairUrl. 현재 m-aac.cbs.co.kr/mweb_{cbs981,cbs939,cbscmc}/_definst_/{key}.stream/playlist.m3u8. 3개 HLS·조각200. www.cbs.co.kr 홈페이지 연결종료와 구 aac.cbs.co.kr DNS 실패는 현재 스트림 실패가 아님. |
| BBS | 서울 불교방송 | [공식 온에어](https://www.bbs.or.kr/HOME2/?ACT=ONAIR&pType=RADIO)의 source src, bbslive.clouducs.com/bbsradio-mlive/radio.stream/playlist.m3u8. HLS·AAC 조각200. 구 bbsradio-live/livestream 경로는 실패. |
| cpbc | 서울 가톨릭평화방송 | [공식](https://www.cpbc.co.kr/), [공식 API](https://apis.cpbc.co.kr/play-api/2.0/onair/channel/radio?ssl=Y)의 onair.source.mediasource.mediaurl. ssl=Y 옵션으로 공식 서버가 cdn-radio-seoul.cpbc.co.kr HTTPS URL을 직접 반환하며 그대로 사용. HLS·조각200. |
| FEBC | 서울극동방송 | [공식 서울 플레이어](https://seoul.febc.net/radio/schedule/live/1)의 source src=https://mlive3.febc.net/live5/seoulfm/playlist.m3u8. 공식 현재 원문 그대로 사용. master200·media200·audio/mp4 조각200(48,937bytes), CORS * 확인. 과거 mlive2 후보는 사용하지 않음. |
| WBS | 원음방송 서울 | [공식 온에어](https://wbsi.kr/onair_radio.php)의 audio data-stream=https://wbsradio.kr/wbs-seoul. HTTP200 audio/mpeg, 실제 MPEG 데이터 수신 확인. 무한 라이브 다운로드를 하지 않고 첫 chunk까지만 검증. 구 www.wbs.co.kr TLS 오류는 현 서비스 실패가 아님. |
| TBN | 부산·전남광주·대구·대전·경인·강원·전북·울산·경남·경북·제주·충북·충남 | [공식 플레이어](https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=1)의 현재 hls.loadSource www.tbn.it.kr/{지역}/myStream/playlist.m3u8. 공식13지역 목록과 onload 키 대조. 전13지역 HLS·조각200. 2026-05-04 URL변경 주석 확인. |

## 네트워크·계약

- `list_stations() -> Result<Catalog, AppError>`, `resolve_stream(&str) -> Result<ResolvedStream, AppError>`; Tauri 경계는 `ApiResult::from(...)`으로 `{ok:true,data}` 또는 `{ok:false,error}` 반환. TS 계약과 camelCase 필드 동일.
- 방송사별 정확한 호스트 allowlist, HTTPS/443, 사용자정보 및 fragment 금지. API/HLS 리다이렉트도 같은 방송사 allowlist로 검증하며 최대3번. WBS는 리다이렉트 거부.
- 각 HTTP 요청 전체10초 제한, 유한 API/HLS 응답256KiB 제한. WBS 라이브는 첫 chunk 후 종료. 사용자에게 원본 reqwest 오류·서명URL을 노출하지 않는다.
- 방송사가 발행한 서명/토큰을 수정하거나 생성하지 않는다. MBC 토큰의 정확한 만료시간은 확인하지 않았으며 매 재생 시 신규 조회한다. resolved URL은 메모리에서만 사용, 카탈로그·설정·로그에 저장하지 않는다.
- 실제 macOS reqwest rustls는 MBC에서 ConnectionReset 발생. HTTP/1 강제·UA 변경만으로 해결되지 않음. **native-tls feature + use_native_tls()**로 인증서 검증을 유지하며 MBC 포함32개 Rust resolver 성공. 현재 Cargo.toml은 native-tls를 사용한다.
- 최종 HLS 후속 요청은 네이티브 HLS를 지원하는 macOS에서는 WKWebView가, Windows WebView2에서는 번들 HLS.js가 수행한다. resolver는 최초 HLS까지만 런타임 검증하고, 개발 probe는 하위목록·첫 조각까지 확인한다.

## 검증 기록

- RED: 기능 작성 전 `rejects_foreign_host` 테스트 추가. `cargo test --offline --lib radio` exit101, `validate_url` 미구현(E0425) 확인.
- GREEN: 호스트 위조/HTTP/포트/자격정보, 악성·손상 JSONP, 중복ID·미등록ID unavailable/한국어 메시지/retryable=false, 계약 envelope, EBS 문자열, 응답 크기 경계, 실제 로컬 timeout 테스트.
- `cargo test --manifest-path src-tauri/Cargo.toml --features reqwest/native-tls --lib radio::tests::live_resolver -- --ignored` 실제32개 resolver 성공 exit0. 이 검사는 외부 네트워크가 필요하며 기본 테스트에서는 ignored.
- `python3 scripts/live-stations-check.py`: 공식 응답→HLS→하위목록→첫 오디오 조각만 bounded probe, ID/결과만 출력. FEBC를 포함한32개 지원 채널 검사. URL과 토큰은 출력·저장하지 않음.
- `npm run build` exit0. 통합 앱 코드 91ffeb4에서 프런트 43개·네이티브 39개·패키지 5개 테스트가 통과했다. 실시간 검사 2개는 일반 네이티브 테스트에서 제외한다.
- sandbox에서 소켓 listen/외부네트워크가 막힐 수 있다. 로컬 timeout 테스트와 live 검사는 권한 있는 실행 환경에서 수행. 네트워크 sandbox 실패를 방송사 장애로 해석하지 않는다.

## 프로그램 정보 원천과 확인 결과

- FEBC `https://seoul.febc.net/api/stream/current?channelId=175` GET200 현재 프로그램 응답.
- cpbc 공식 API `onair.info.title` 및 정보 필드.
- EBS 공식 페이지 `/onair/cururentOnair.json` 호출(철자 원문 그대로), 편성표 `/schedule`.
- CBS `https://cbs.co.kr/schedule/all/ajax` GET JSON: tv/fm/musicfm/joy4u.
- WBS 공식 온에어 HTML `.tit` 제목과 방송시간 문자열.
- MBC https://miniapi.imbc.com/Schedule/schedulelist 편성표의 STFM/FM4U/CHAM을 서울 표준FM/FM4U/올댓뮤직에 대응시켰다. 세 채널의 현재 구간 확인을 마쳤으며 편성표 기준으로 표시한다.
- KBS static.api.kbs.co.kr/mediafactory/v1/schedule/onair_now, SBS static.apis.sbs.co.kr/radio-api/gorealra/1.0/main/section/common, BBS 공식 온에어 HTML의 ProgramNamePage/BroadCastTimePage를 사용한다.
- 현재 정보 총 18개 채널 확인. TBN 13개는 정확한 지역 어댑터가 있으나 네이티브 TLS 조회 시간 초과로 확인 불가다. KBS 한민족은 외부 채널 26과 내부 응답 27의 불일치로 확인 불가이며 임의로 치환하지 않는다.

2026-10-09 [MBC 공식 webapp JS](https://miniwebapp.imbc.com/static/js/main.6c55a947.js)의 고지를 재확인했다. 사전 동의 없는 영리 목적 사용·재링크(링크 제공 포함)를 제한한다. 사용자 요청에 따른 이번 시험판은 무료·비영리이며, 명시적인 제3자 앱 허가를 받은 것으로 표시하지 않는다. 기술 접속 확인과 권리자의 동의는 별개다. 개인 중개 서버나 인증 우회는 사용하지 않았다.

후속 검토 반영: SBS·cpbc API 모두 ssl=Y의 HTTPS 직접 반환을 실측하여 URL scheme 변환을 제거했다. 서명·경로·scheme 모두 응답 원문 유지. 미등록ID 직접 resolver 테스트를 추가했다.

FEBC 후속 검증: 공식 플레이어·streamKey·허용 CDN 매핑 테스트 선작성 후 기존 unavailable에 대해 RED exit101 확인. 현재 공식 source로 resolver·카탈로그·probe를 연결했다. 실제 청취 품질 검증과 배포 허가 판단은 여전히 별도다.

### KBS 프로그램 이미지 — 2026-10-10

공식 `onair_now` 편성 응답의 `schedules[].image_w`를 사용한다. 외부 채널·행의 채널 코드와 지역 `00`, 프로그램명이 모두 일치할 때만 표시한다. 이미지 호스트는 `programres.kbs.co.kr` 및 `mediafactory.play.kbs.co.kr`로 제한한다. 현재 6개 채널의 이미지 주소를 실제 확인했으며 HappyFM 이미지의 HTTP 200·JPEG 응답을 확인했다. 이미지 이용 허가와 기술 연결 성공은 별개다.
