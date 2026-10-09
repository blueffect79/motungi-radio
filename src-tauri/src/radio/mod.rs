//! Official station catalog and ephemeral stream resolution. Never log stream URLs.
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, time::Duration};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    Network,
    Timeout,
    Unavailable,
    InvalidResponse,
    UnsupportedFormat,
    OsRegistration,
    Storage,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    pub retryable: bool,
}
impl AppError {
    pub fn new(code: ErrorCode, message: &str, retryable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            retryable,
        }
    }
}
#[derive(Debug, Serialize)]
#[serde(untagged)]
pub enum ApiResult<T> {
    Success { ok: bool, data: T },
    Failure { ok: bool, error: AppError },
}
impl<T> From<Result<T, AppError>> for ApiResult<T> {
    fn from(r: Result<T, AppError>) -> Self {
        match r {
            Ok(data) => Self::Success { ok: true, data },
            Err(error) => Self::Failure { ok: false, error },
        }
    }
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Station {
    pub id: String,
    pub provider_id: String,
    pub name: String,
    pub region: Option<String>,
    pub group_id: Option<String>,
    pub official_page_url: String,
    pub stream_key: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Catalog {
    pub version: u32,
    pub stations: Vec<Station>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StreamFormat {
    Hls,
    Aac,
    Mp3,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedStream {
    pub station_id: String,
    pub url: String,
    pub format: StreamFormat,
    pub resolved_at: String,
}
const LIMIT: usize = 256 * 1024;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
fn invalid() -> AppError {
    AppError::new(
        ErrorCode::InvalidResponse,
        "방송사 응답을 확인할 수 없습니다.",
        false,
    )
}
fn hosts(provider: &str) -> &'static [&'static str] {
    match provider {
        "mbc" => &[
            "sminiplay.imbc.com",
            "minisw.imbc.com",
            "minimw.imbc.com",
            "minicw.imbc.com",
        ],
        "kbs" => &[
            "cfpwwwapi.kbs.co.kr",
            "1radio.gscdn.kbs.co.kr",
            "2radio.gscdn.kbs.co.kr",
            "3radio.gscdn.kbs.co.kr",
            "1fm.gscdn.kbs.co.kr",
            "2fm.gscdn.kbs.co.kr",
            "hanminjokradio.gscdn.kbs.co.kr",
        ],
        "sbs" => &["apis.sbs.co.kr", "radiolive.sbs.co.kr"],
        "cpbc" => &["apis.cpbc.co.kr", "cdn-radio-seoul.cpbc.co.kr"],
        "ebs" => &["www.ebs.co.kr", "liveotu.ebs.co.kr"],
        "tbn" => &["www.tbn.it.kr"],
        "wbs" => &["wbsradio.kr"],
        "cbs" => &["m-aac.cbs.co.kr"],
        "bbs" => &["bbslive.clouducs.com"],
        "febc" => &["mlive3.febc.net"],
        _ => &[],
    }
}
pub fn validate_url(raw: &str, provider: &str) -> Result<Url, AppError> {
    let u = Url::parse(raw).map_err(|_| invalid())?;
    if u.scheme() != "https"
        || !u.username().is_empty()
        || u.password().is_some()
        || u.port_or_known_default() != Some(443)
        || u.fragment().is_some()
        || !hosts(provider).contains(&u.host_str().unwrap_or(""))
    {
        return Err(invalid());
    }
    Ok(u)
}
pub fn list_stations() -> Result<Catalog, AppError> {
    let c: Catalog = serde_json::from_str(include_str!("../../../resources/stations.json"))
        .map_err(|_| invalid())?;
    validate_catalog(&c)?;
    Ok(c)
}
fn validate_catalog(c: &Catalog) -> Result<(), AppError> {
    let mut ids = HashSet::new();
    if c.version != 1 {
        return Err(invalid());
    }
    for s in &c.stations {
        if s.id.is_empty()
            || !ids.insert(&s.id)
            || !matches!(
                s.provider_id.as_str(),
                "mbc" | "kbs" | "sbs" | "cpbc" | "ebs" | "tbn" | "cbs" | "bbs" | "febc" | "wbs"
            )
            || (s.group_id.is_some()
                && (s.provider_id != "tbn" || s.group_id.as_deref() != Some("tbn")))
            || Url::parse(&s.official_page_url).map_or(true, |u| u.scheme() != "https")
        {
            return Err(invalid());
        }
    }
    Ok(())
}
fn network(e: reqwest::Error) -> AppError {
    let e = e.without_url();
    if e.is_timeout() {
        AppError::new(
            ErrorCode::Timeout,
            "방송사 응답 시간이 초과되었습니다.",
            true,
        )
    } else {
        AppError::new(ErrorCode::Network, "방송사에 연결할 수 없습니다.", true)
    }
}
async fn probe_mp3(raw: &str, provider: &str) -> Result<(), AppError> {
    let u = validate_url(raw, provider)?;
    let mut r = reqwest::Client::builder()
        .use_native_tls()
        .http1_only()
        .user_agent("RadioKorea/0.1")
        .timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(network)?
        .get(u)
        .send()
        .await
        .map_err(network)?;
    if !r.status().is_success() {
        return Err(AppError::new(
            ErrorCode::Unavailable,
            "방송사가 스트림 요청을 거부했습니다.",
            true,
        ));
    }
    let kind = r
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !kind.starts_with("audio/mpeg") {
        return Err(invalid());
    }
    if r.chunk().await.map_err(network)?.is_none() {
        return Err(invalid());
    }
    Ok(())
}
fn append_bounded(b: &mut Vec<u8>, chunk: &[u8]) -> Result<(), AppError> {
    if b.len() + chunk.len() > LIMIT {
        return Err(invalid());
    }
    b.extend_from_slice(chunk);
    Ok(())
}
async fn fetch(raw: &str, provider: &str) -> Result<String, AppError> {
    let url = validate_url(raw, provider)?;
    let p = provider.to_owned();
    let client = reqwest::Client::builder()
        .use_native_tls()
        .http1_only()
        .user_agent("RadioKorea/0.1")
        .timeout(REQUEST_TIMEOUT)
        .redirect(reqwest::redirect::Policy::custom(move |a| {
            if a.previous().len() >= 3 || validate_url(a.url().as_str(), &p).is_err() {
                a.error("unapproved redirect")
            } else {
                a.follow()
            }
        }))
        .build()
        .map_err(network)?;
    let mut r = client.get(url).send().await.map_err(network)?;
    if !r.status().is_success() {
        return Err(AppError::new(
            ErrorCode::Unavailable,
            "방송사가 스트림 요청을 거부했습니다.",
            true,
        ));
    }
    if r.content_length().is_some_and(|n| n > LIMIT as u64) {
        return Err(invalid());
    }
    let mut b = Vec::new();
    while let Some(chunk) = r.chunk().await.map_err(network)? {
        append_bounded(&mut b, &chunk)?;
    }
    String::from_utf8(b).map_err(|_| invalid())
}
fn parse_mbc(s: &str) -> Result<String, AppError> {
    let body = s
        .trim()
        .strip_prefix("__aacplay(")
        .and_then(|v| v.strip_suffix(");").or_else(|| v.strip_suffix(')')))
        .ok_or_else(invalid)?;
    let v: serde_json::Value = serde_json::from_str(body).map_err(|_| invalid())?;
    v.get("AACLiveURL")
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .ok_or_else(invalid)
}
fn parse_kbs(s: &str) -> Result<String, AppError> {
    let v: serde_json::Value = serde_json::from_str(s).map_err(|_| invalid())?;
    v.get("channel_item")
        .and_then(|x| x.as_array())
        .and_then(|a| {
            a.iter()
                .filter_map(|x| x.get("service_url").and_then(|v| v.as_str()))
                .find(|s| s.starts_with("https://") && s.contains(".m3u8"))
        })
        .map(str::to_owned)
        .ok_or_else(invalid)
}
fn parse_ebs(body: &str) -> Result<String, AppError> {
    let prefix = "https://liveotu.ebs.co.kr/fm/";
    let start = body.find(prefix).ok_or_else(invalid)?;
    let rest = &body[start..];
    let end = rest
        .find(['\'', '"', '<', '>', ' ', '\n', '\r'])
        .ok_or_else(invalid)?;
    Ok(rest[..end].replace("&amp;", "&"))
}
pub async fn resolve_stream(station_id: &str) -> Result<ResolvedStream, AppError> {
    let station = list_stations()?
        .stations
        .into_iter()
        .find(|s| s.id == station_id)
        .ok_or_else(|| AppError::new(ErrorCode::Unavailable, "등록되지 않은 채널입니다.", false))?;
    if station.stream_key == "unavailable" {
        return Err(AppError::new(
            ErrorCode::Unavailable,
            "이 채널의 공식 HTTPS 연결은 아직 확인되지 않았습니다.",
            false,
        ));
    }
    let p = station.provider_id.as_str();
    let url=match p {
 "cpbc"=>{let body=fetch("https://apis.cpbc.co.kr/play-api/2.0/onair/channel/radio?ssl=Y",p).await?;let v:serde_json::Value=serde_json::from_str(&body).map_err(|_|invalid())?;let raw=v.pointer("/onair/source/mediasource/mediaurl").and_then(|x|x.as_str()).ok_or_else(invalid)?;raw.to_owned()},
 "ebs"=>{let body=fetch("https://www.ebs.co.kr/onair?channelCodeString=radio",p).await?;parse_ebs(&body)?},
 "wbs"=>{probe_mp3("https://wbsradio.kr/wbs-seoul",p).await?;return Ok(ResolvedStream{station_id:station.id,url:"https://wbsradio.kr/wbs-seoul".into(),format:StreamFormat::Mp3,resolved_at:chrono::Utc::now().to_rfc3339()})},
 "febc"=>"https://mlive3.febc.net/live5/seoulfm/playlist.m3u8".into(),
 "bbs"=>"https://bbslive.clouducs.com/bbsradio-mlive/radio.stream/playlist.m3u8".into(),
 "cbs"=>format!("https://m-aac.cbs.co.kr/mweb_{0}/_definst_/{0}.stream/playlist.m3u8",station.stream_key),
 "tbn"=>format!("https://www.tbn.it.kr/{}/myStream/playlist.m3u8",station.stream_key),
 "mbc"=>parse_mbc(&fetch(&format!("https://sminiplay.imbc.com/aacplay.ashx?channel={}&protocol=M3U8&agent=webapp&callback=__aacplay",station.stream_key),p).await?)?,
 "kbs"=>parse_kbs(&fetch(&format!("https://cfpwwwapi.kbs.co.kr/api/v1/landing/live/channel_code/{}",station.stream_key),p).await?)?,
 "sbs"=>{let body=fetch(&format!("https://apis.sbs.co.kr/play-api/1.0/livestream/{}?protocol=hls&ssl=Y",station.stream_key),p).await?;body.trim().to_owned()},_=>return Err(invalid())};
    validate_url(&url, p)?;
    let manifest = fetch(&url, p).await?;
    if !manifest.trim_start().starts_with("#EXTM3U") {
        return Err(AppError::new(
            ErrorCode::UnsupportedFormat,
            "지원하지 않는 스트림 형식입니다.",
            false,
        ));
    }
    Ok(ResolvedStream {
        station_id: station.id,
        url,
        format: StreamFormat::Hls,
        resolved_at: chrono::Utc::now().to_rfc3339(),
    })
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_foreign_host() {
        for u in [
            "https://evil.test/a.m3u8",
            "http://minisw.imbc.com/a",
            "https://minisw.imbc.com.evil.test/a",
            "https://user@minisw.imbc.com/a",
            "https://minisw.imbc.com:444/a",
        ] {
            assert!(validate_url(u, "mbc").is_err())
        }
        assert!(validate_url("https://minisw.imbc.com/a?token=test", "mbc").is_ok());
    }
    #[test]
    fn jsonp_is_data_only() {
        assert_eq!(
            parse_mbc("__aacplay({\"AACLiveURL\":\"https://minisw.imbc.com/a\"});").unwrap(),
            "https://minisw.imbc.com/a"
        );
        for bad in [
            "alert({})",
            "__aacplay({});alert(1)",
            "__aacplay({bad})",
            "__aacplay({})",
            "__aacplay({\"AACLiveURL\":null})",
        ] {
            assert!(parse_mbc(bad).is_err())
        }
    }
    #[test]
    fn unknown_station_is_non_retryable_unavailable() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(resolve_stream("not-a-registered-station"));
        let error = match result {
            Err(error) => error,
            Ok(_) => panic!("unknown station resolved"),
        };
        assert_eq!(error.code, ErrorCode::Unavailable);
        assert_eq!(error.message, "등록되지 않은 채널입니다.");
        assert!(!error.retryable);
    }
    #[test]
    fn febc_uses_current_official_player_and_stream_host() {
        let station = list_stations()
            .unwrap()
            .stations
            .into_iter()
            .find(|s| s.id == "febc-seoul")
            .unwrap();
        assert_eq!(station.stream_key, "seoulfm");
        assert_eq!(
            station.official_page_url,
            "https://seoul.febc.net/radio/schedule/live/1"
        );
        assert!(validate_url(
            "https://mlive3.febc.net/live5/seoulfm/playlist.m3u8",
            "febc"
        )
        .is_ok());
        assert!(
            validate_url("https://mlive2.febc.net/live/seoulfm/playlist.m3u8", "febc").is_err()
        );
    }
    #[test]
    fn catalog_ids_and_duplicates() {
        let mut c = list_stations().unwrap();
        for id in ["mbc-sfm", "mbc-mfm", "mbc-chm"] {
            assert!(c.stations.iter().any(|s| s.id == id))
        }
        c.stations.push(c.stations[0].clone());
        assert!(validate_catalog(&c).is_err());
    }
    #[test]
    fn response_size_is_bounded() {
        let mut b = vec![0; LIMIT - 1];
        assert!(append_bounded(&mut b, &[1]).is_ok());
        assert!(append_bounded(&mut b, &[2]).is_err());
        assert_eq!(b.len(), LIMIT);
    }
    #[test]
    fn real_timeout_maps_to_safe_error() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let rt = tokio::runtime::Runtime::new().unwrap();
        let e = rt.block_on(async {
            reqwest::Client::builder()
                .timeout(Duration::from_millis(30))
                .build()
                .unwrap()
                .get(format!("http://{addr}"))
                .send()
                .await
                .unwrap_err()
        });
        let e = network(e);
        assert_eq!(e.code, ErrorCode::Timeout);
        assert!(e.retryable);
        assert!(!e.message.contains("127.0.0.1"));
    }
    #[test]
    fn ebs_extracts_data_without_execution() {
        assert_eq!(
            parse_ebs("src: 'https://liveotu.ebs.co.kr/fm/a.m3u8?a=1&amp;b=2'").unwrap(),
            "https://liveotu.ebs.co.kr/fm/a.m3u8?a=1&b=2"
        );
        assert!(parse_ebs("src: 'https://evil.test/a'").is_err());
    }
    #[test]
    #[ignore = "live official network probe"]
    fn live_resolver() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        for s in list_stations().unwrap().stations {
            if s.stream_key == "unavailable" {
                continue;
            }
            let r = rt.block_on(resolve_stream(&s.id));
            assert!(r.is_ok(), "{}: {:?}", s.id, r.err());
        }
    }

    #[test]
    fn envelope_contract() {
        let v = serde_json::to_value(ApiResult::<()>::from(Err(invalid()))).unwrap();
        assert_eq!(v["ok"], false);
        assert_eq!(v["error"]["code"], "invalid_response");
    }
    #[test]
    fn kbs_rejects_missing_or_http_stream() {
        for s in [
            "{}",
            r#"{"channel_item":[{"service_url":"http://x/a.m3u8"}]}"#,
        ] {
            assert!(parse_kbs(s).is_err())
        }
    }
}
