//! Official metadata only. Failure never influences stream playback.
use crate::radio::{AppError, ErrorCode};
use chrono::{DateTime, Datelike, FixedOffset, NaiveDate, TimeZone, Utc};
use serde::Serialize;
use serde_json::Value;
use std::{
    collections::HashMap,
    sync::{Arc, OnceLock},
    time::Duration,
};
use tokio::sync::Mutex;
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgramState {
    pub station_id: String,
    pub status: String,
    pub source_kind: Option<String>,
    pub title: Option<String>,
    pub starts_at: Option<String>,
    pub ends_at: Option<String>,
    pub fetched_at: String,
    pub source_url: Option<String>,
}
#[derive(Clone)]
struct Slot {
    title: String,
    start: DateTime<FixedOffset>,
    end: DateTime<FixedOffset>,
}
fn endpoint(id: &str) -> Option<&'static str> {
    match id.split('-').next()? {
        "mbc" => Some("https://miniapi.imbc.com/Schedule/schedulelist"),
        "cbs" => Some("https://cbs.co.kr/schedule/all/ajax"),
        "febc" => Some("https://seoul.febc.net/api/stream/current?channelId=175"),
        "cpbc" => Some("https://apis.cpbc.co.kr/play-api/2.0/onair/channel/radio?ssl=Y"),
        _ => None,
    }
}
fn text<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(Value::as_str).unwrap_or("")
}
fn time(date: NaiveDate, s: &str) -> Option<DateTime<FixedOffset>> {
    let s = s.replace(':', "");
    if s.len() != 4 || !s.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let h: u32 = s[..2].parse().ok()?;
    let m: u32 = s[2..].parse().ok()?;
    let date = if h == 24 && m == 0 {
        date.succ_opt()?
    } else {
        date
    };
    FixedOffset::east_opt(9 * 3600)?
        .from_local_datetime(&date.and_hms_opt(if h == 24 && m == 0 { 0 } else { h }, m, 0)?)
        .single()
}
fn slot(
    date: NaiveDate,
    start: &str,
    end: &str,
    title: &str,
    now: DateTime<FixedOffset>,
) -> Option<Slot> {
    if title.trim().is_empty() {
        return None;
    }
    let start = time(date, start)?;
    let mut end = time(date, end)?;
    if end < start {
        end += chrono::Duration::days(1)
    }
    if start <= now && now < end {
        Some(Slot {
            title: title.trim().into(),
            start,
            end,
        })
    } else {
        None
    }
}
fn cbs_title(v: &Value) -> &str {
    for key in ["title", "name"] {
        let t = text(v, key);
        if !t.trim().is_empty() {
            return t;
        }
    }
    v.pointer("/program/name")
        .and_then(Value::as_str)
        .unwrap_or("")
}
fn parse(id: &str, v: &Value, now: DateTime<FixedOffset>) -> Vec<Slot> {
    let mut result = Vec::new();
    let today = now.date_naive();
    if id.starts_with("mbc-") {
        let channel = match id {
            "mbc-sfm" => "STFM",
            "mbc-mfm" => "FM4U",
            "mbc-chm" => "CHAM",
            _ => return result,
        };
        if let Some(rows) = v.as_array() {
            for date in [today.pred_opt().unwrap(), today] {
                let day = ["월", "화", "수", "목", "금", "토", "일"]
                    [date.weekday().num_days_from_monday() as usize];
                for row in rows {
                    if text(row, "Channel") == channel && text(row, "LiveDays") == day {
                        if let Some(s) = slot(
                            date,
                            text(row, "StartTime"),
                            text(row, "EndTime"),
                            text(row, "ProgramTitle"),
                            now,
                        ) {
                            result.push(s)
                        }
                    }
                }
            }
        }
    } else if id.starts_with("cbs-") {
        let key = match id {
            "cbs-standard" => "fm",
            "cbs-music" => "musicfm",
            "cbs-joy4u" => "joy4u",
            _ => return result,
        };
        if let Some(rows) = v.get(key).and_then(Value::as_array) {
            for row in rows {
                if let Ok(date) = NaiveDate::parse_from_str(text(row, "date"), "%Y-%m-%d") {
                    if let Some(s) = slot(
                        date,
                        text(row, "startTime"),
                        text(row, "endTime"),
                        cbs_title(row),
                        now,
                    ) {
                        result.push(s)
                    }
                }
            }
        }
    } else if id == "cpbc-seoul" {
        if let Some(info) = v.pointer("/onair/info") {
            if text(info, "channelid").eq_ignore_ascii_case("radio") {
                for date in [today.pred_opt().unwrap(), today] {
                    if let Some(s) = slot(
                        date,
                        text(info, "starttime"),
                        text(info, "endtime"),
                        text(info, "title"),
                        now,
                    ) {
                        result.push(s)
                    }
                }
            }
        }
    } else if id == "febc-seoul" {
        for date in [today.pred_opt().unwrap(), today] {
            if let Some(s) = slot(
                date,
                text(v, "startTime"),
                text(v, "endTime"),
                text(v, "title"),
                now,
            ) {
                result.push(s)
            }
        }
    }
    result
}
fn state(
    id: &str,
    v: Option<&Value>,
    now: DateTime<FixedOffset>,
    fetched: DateTime<FixedOffset>,
) -> ProgramState {
    let slots = v.map(|v| parse(id, v, now)).unwrap_or_default();
    let mut state = ProgramState {
        station_id: id.into(),
        status: "unavailable".into(),
        source_kind: None,
        title: None,
        starts_at: None,
        ends_at: None,
        fetched_at: fetched.to_rfc3339(),
        source_url: endpoint(id).map(str::to_owned),
    };
    if slots.len() == 1 {
        let s = &slots[0];
        state.status = "available".into();
        state.source_kind = Some(
            if id.starts_with("cpbc") || id.starts_with("febc") {
                "live"
            } else {
                "schedule"
            }
            .into(),
        );
        state.title = Some(s.title.clone());
        state.starts_at = Some(s.start.to_rfc3339());
        state.ends_at = Some(s.end.to_rfc3339());
    }
    state
}
fn next_refresh(
    v: Option<&Value>,
    ids: &[&str],
    now: DateTime<FixedOffset>,
    failures: u32,
) -> DateTime<FixedOffset> {
    let seconds = if failures > 0 {
        (15i64 * 2i64.pow(failures.min(5))).min(300)
    } else {
        300
    };
    let mut next = now + chrono::Duration::seconds(seconds);
    if let Some(v) = v {
        for id in ids {
            for s in parse(id, v, now) {
                next = next.min(s.end)
            }
        }
    }
    next
}
fn invalid() -> AppError {
    AppError::new(
        ErrorCode::InvalidResponse,
        "프로그램 정보를 확인할 수 없습니다.",
        true,
    )
}
fn valid_url(u: &url::Url) -> bool {
    u.scheme() == "https"
        && u.username().is_empty()
        && u.password().is_none()
        && u.port_or_known_default() == Some(443)
        && [
            "miniapi.imbc.com",
            "cbs.co.kr",
            "apis.cpbc.co.kr",
            "seoul.febc.net",
        ]
        .contains(&u.host_str().unwrap_or(""))
}
async fn fetch(raw: &str) -> Result<Value, AppError> {
    let u = url::Url::parse(raw).map_err(|_| invalid())?;
    if !valid_url(&u) {
        return Err(invalid());
    }
    let client = reqwest::Client::builder()
        .use_native_tls()
        .http1_only()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::custom(|a| {
            if a.previous().len() < 3 && valid_url(a.url()) {
                a.follow()
            } else {
                a.error("unapproved redirect")
            }
        }))
        .build()
        .map_err(|_| invalid())?;
    let mut response = client.get(u).send().await.map_err(|_| invalid())?;
    const LIMIT: usize = 2 * 1024 * 1024;
    if !response.status().is_success()
        || response.content_length().is_some_and(|n| n > LIMIT as u64)
    {
        return Err(invalid());
    }
    let mut body = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| invalid())? {
        if body.len() + chunk.len() > LIMIT {
            return Err(invalid());
        }
        body.extend_from_slice(&chunk)
    }
    serde_json::from_slice(&body).map_err(|_| invalid())
}
struct Cache {
    value: Option<Value>,
    fetched: DateTime<FixedOffset>,
    next: DateTime<FixedOffset>,
    failures: u32,
}
type SharedCache = Arc<Mutex<Option<Cache>>>;
static CACHE: OnceLock<Mutex<HashMap<String, SharedCache>>> = OnceLock::new();
fn now() -> DateTime<FixedOffset> {
    Utc::now().with_timezone(&FixedOffset::east_opt(9 * 3600).unwrap())
}
async fn cached<F, Fut>(
    shared: &Mutex<Option<Cache>>,
    ids: &[&str],
    load: F,
) -> (Option<Value>, DateTime<FixedOffset>)
where
    F: FnOnce() -> Fut,
    Fut: std::future::Future<Output = Option<Value>>,
{
    let mut cache = shared.lock().await;
    let t = now();
    if cache.as_ref().map_or(true, |c| t >= c.next) {
        let value = load().await;
        let fetched = now();
        let failures = if value.is_some() {
            0
        } else {
            cache.as_ref().map_or(0, |c| c.failures).saturating_add(1)
        };
        let next = next_refresh(value.as_ref(), ids, fetched, failures);
        *cache = Some(Cache {
            value,
            fetched,
            next,
            failures,
        });
    }
    let c = cache.as_ref().unwrap();
    (c.value.clone(), c.fetched)
}
/// One lock per broadcaster coalesces concurrent requests. Errors replace cached data.
pub async fn get_programs(station_ids: Vec<String>) -> Result<Vec<ProgramState>, AppError> {
    let catalog = crate::radio::list_stations()?;
    if station_ids.len() > 64 {
        return Err(invalid());
    }
    let mut groups: HashMap<&str, Vec<&str>> = HashMap::new();
    let mut result = Vec::new();
    for id in &station_ids {
        if !catalog.stations.iter().any(|s| s.id == *id) {
            result.push(state(id, None, now(), now()));
            continue;
        }
        if let Some(url) = endpoint(id) {
            groups.entry(url).or_default().push(id)
        } else {
            result.push(state(id, None, now(), now()));
        }
    }
    for (url, ids) in groups {
        let shared = {
            let mut map = CACHE
                .get_or_init(|| Mutex::new(HashMap::new()))
                .lock()
                .await;
            map.entry(url.into())
                .or_insert_with(|| Arc::new(Mutex::new(None)))
                .clone()
        };
        let all_ids: Vec<&str> = catalog
            .stations
            .iter()
            .filter(|s| endpoint(&s.id) == Some(url))
            .map(|s| s.id.as_str())
            .collect();
        let (value, fetched) = cached(&shared, &all_ids, || async { fetch(url).await.ok() }).await;
        for id in ids {
            result.push(state(id, value.as_ref(), now(), fetched));
        }
    }

    Ok(result)
}
#[cfg(test)]
mod tests;
