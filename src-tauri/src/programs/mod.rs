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
    if id.starts_with("tbn-") {
        return match id {
            "tbn-busan" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=2"),
            "tbn-gwangju" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=3"),
            "tbn-daegu" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=4"),
            "tbn-daejeon" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=5"),
            "tbn-gyeongin" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=6"),
            "tbn-gangwon" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=7"),
            "tbn-jeonbuk" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=8"),
            "tbn-ulsan" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=9"),
            "tbn-gyeongnam" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=10"),
            "tbn-kyungbuk" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=11"),
            "tbn-jeju" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=12"),
            "tbn-chungbuk" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=13"),
            "tbn-chungnam" => Some("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=14"),
            _ => None,
        };
    }
    match id.split('-').next()? {
        "kbs" => Some("https://static.api.kbs.co.kr/mediafactory/v1/schedule/onair_now?local_station_code=00&channel_code=21,22,23,24,25,26"),
        "sbs" => Some("https://static.apis.sbs.co.kr/radio-api/gorealra/1.0/main/section/common"),
        "ebs" => Some("https://www.ebs.co.kr/onair/cururentOnair.json?channelCd=RADIO&nowDate="),
        "bbs" => Some("https://www.bbs.or.kr/HOME2/?ACT=ONAIR&pType=RADIO"),
        "wbs" => Some("https://wbsi.kr/onair_radio.php"),
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
fn time(date: NaiveDate, raw: &str) -> Option<DateTime<FixedOffset>> {
    let normalized = if raw.contains(':') {
        let parts: Vec<&str> = raw.split(':').collect();
        if parts.len() != 2 || parts[0].is_empty() || parts[0].len() > 2 || parts[1].len() != 2 {
            return None;
        }
        format!("{:0>2}{}", parts[0], parts[1])
    } else {
        raw.to_owned()
    };
    let s = normalized.as_str();
    if ![4, 8].contains(&s.len()) || !s.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    let h: u32 = s[..2].parse().ok()?;
    let m: u32 = s[2..4].parse().ok()?;
    let seconds: u32 = if s.len() == 8 {
        s[4..6].parse().ok()?
    } else {
        0
    };
    let nanos: u32 = if s.len() == 8 {
        s[6..].parse::<u32>().ok()? * 10_000_000
    } else {
        0
    };
    let midnight = h == 24 && m == 0 && seconds == 0 && nanos == 0;
    let date = if midnight { date.succ_opt()? } else { date };
    FixedOffset::east_opt(9 * 3600)?
        .from_local_datetime(&date.and_hms_nano_opt(
            if midnight { 0 } else { h },
            m,
            seconds,
            nanos,
        )?)
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
    if id.starts_with("kbs-") {
        if let Some(channels) = v.as_array() {
            for channel in channels {
                if text(channel, "channel_code") == id.trim_start_matches("kbs-")
                    && text(channel, "local_station_code") == "00"
                {
                    if let Some(rows) = channel.get("schedules").and_then(Value::as_array) {
                        for row in rows {
                            if text(row, "channel_code") != id.trim_start_matches("kbs-")
                                || text(row, "local_station_code") != "00"
                            {
                                continue;
                            }
                            if let Ok(date) = NaiveDate::parse_from_str(
                                text(row, "program_planned_date"),
                                "%Y%m%d",
                            ) {
                                if let Some(s) = slot(
                                    date,
                                    text(row, "program_planned_start_time"),
                                    text(row, "program_planned_end_time"),
                                    text(row, "program_title"),
                                    now,
                                ) {
                                    result.push(s)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if id == "ebs-fm" {
        if let Some(row) = v.get("nowProgram") {
            if text(row, "channelCode") == "RADIO" {
                if let Ok(date) = NaiveDate::parse_from_str(text(row, "onairDate"), "%Y%m%d") {
                    if let Some(s) = slot(
                        date,
                        text(row, "start"),
                        text(row, "end"),
                        text(row, "title"),
                        now,
                    ) {
                        result.push(s)
                    }
                }
            }
        }
    }
    if id == "sbs-powerpc" || id == "sbs-lovepc" {
        let key = if id == "sbs-powerpc" { "power" } else { "love" };
        if let Some(rows) = v
            .get("schedule")
            .and_then(|v| v.get(key))
            .and_then(Value::as_array)
        {
            for row in rows {
                if text(row, "channel") == key && text(row, "onair_flag") == "Y" {
                    for date in [today.pred_opt().unwrap(), today] {
                        if let Some(s) = slot(
                            date,
                            text(row, "start_time"),
                            text(row, "end_time"),
                            text(row, "title"),
                            now,
                        ) {
                            result.push(s)
                        }
                    }
                }
            }
        }
    }
    if id.starts_with("tbn-") && text(v, "region") == id.trim_start_matches("tbn-") {
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
    if id == "wbs-seoul" || id == "bbs-seoul" {
        for date in [today.pred_opt().unwrap(), today] {
            if v.get("days").and_then(Value::as_array).is_some_and(|days| {
                days.iter()
                    .any(|d| d.as_u64() == Some(date.weekday().num_days_from_monday() as u64))
            }) {
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
            if id.starts_with("cpbc")
                || id.starts_with("febc")
                || id.starts_with("wbs")
                || id.starts_with("bbs")
                || id.starts_with("ebs")
                || id.starts_with("tbn")
            {
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
            "static.api.kbs.co.kr",
            "static.apis.sbs.co.kr",
            "www.ebs.co.kr",
            "www.bbs.or.kr",
            "www.tbn.or.kr",
            "wbsi.kr",
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
        .user_agent("RadioKorea/0.1")
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
    if raw == "https://wbsi.kr/onair_radio.php" {
        return parse_wbs(std::str::from_utf8(&body).map_err(|_| invalid())?);
    }
    if raw == "https://www.bbs.or.kr/HOME2/?ACT=ONAIR&pType=RADIO" {
        return parse_bbs(std::str::from_utf8(&body).map_err(|_| invalid())?);
    }
    if let Some(code) = raw.strip_prefix("https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=") {
        let index = code
            .parse::<usize>()
            .ok()
            .and_then(|n| n.checked_sub(2))
            .ok_or_else(invalid)?;
        let region = [
            "busan",
            "gwangju",
            "daegu",
            "daejeon",
            "gyeongin",
            "gangwon",
            "jeonbuk",
            "ulsan",
            "gyeongnam",
            "kyungbuk",
            "jeju",
            "chungbuk",
            "chungnam",
        ]
        .get(index)
        .ok_or_else(invalid)?;
        return parse_tbn(std::str::from_utf8(&body).map_err(|_| invalid())?, region);
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
static TBN_REQUEST_SLOTS: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
static REQUEST_SLOTS: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
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
    let mut tasks = tokio::task::JoinSet::new();
    let slots = REQUEST_SLOTS
        .get_or_init(|| Arc::new(tokio::sync::Semaphore::new(8)))
        .clone();
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
        let all_ids: Vec<String> = catalog
            .stations
            .iter()
            .filter(|s| endpoint(&s.id) == Some(url))
            .map(|s| s.id.clone())
            .collect();
        let ids: Vec<String> = ids.into_iter().map(str::to_owned).collect();
        // Fixed official endpoint set bounds parallelism; slow broadcasters do not serialize others.
        let slots = slots.clone();
        let tbn_slots = TBN_REQUEST_SLOTS
            .get_or_init(|| Arc::new(tokio::sync::Semaphore::new(2)))
            .clone();
        tasks.spawn(async move {
            let _permits = acquire_request_budget(url, &slots, &tbn_slots).await;
            let all_refs: Vec<&str> = all_ids.iter().map(String::as_str).collect();
            let (value, fetched) =
                cached(&shared, &all_refs, || async { fetch(url).await.ok() }).await;
            ids.into_iter()
                .map(|id| state(&id, value.as_ref(), now(), fetched))
                .collect::<Vec<_>>()
        });
    }
    if tokio::time::timeout(Duration::from_secs(10), async {
        while let Some(joined) = tasks.join_next().await {
            if let Ok(values) = joined {
                result.extend(values)
            }
        }
    })
    .await
    .is_err()
    {
        tasks.abort_all();
        // Drain canceled tasks to release cache guards before marking timeout backoff.
        while tasks.join_next().await.is_some() {}
    }
    for id in &station_ids {
        if !result.iter().any(|s| s.station_id == *id) {
            if let Some(url) = endpoint(id) {
                let shared = CACHE
                    .get_or_init(|| Mutex::new(HashMap::new()))
                    .lock()
                    .await
                    .get(url)
                    .cloned();
                if let Some(shared) = shared {
                    let mut cache = shared.lock().await;
                    let t = now();
                    if cache.as_ref().map_or(true, |c| c.next <= t) {
                        let failures = cache.as_ref().map_or(0, |c| c.failures).saturating_add(1);
                        *cache = Some(Cache {
                            value: None,
                            fetched: t,
                            next: next_refresh(None, &[], t, failures),
                            failures,
                        });
                    }
                }
            }
            result.push(state(id, None, now(), now()));
        }
    }

    let returned_at = now();
    for value in &mut result {
        if value.status == "available" {
            let valid = value
                .starts_at
                .as_ref()
                .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
                .zip(
                    value
                        .ends_at
                        .as_ref()
                        .and_then(|s| DateTime::parse_from_rfc3339(s).ok()),
                )
                .is_some_and(|(start, end)| start <= returned_at && returned_at < end);
            if !valid {
                *value = state(
                    &value.station_id,
                    None,
                    returned_at,
                    DateTime::parse_from_rfc3339(&value.fetched_at).unwrap_or(returned_at),
                );
            }
        }
    }
    Ok(result)
}
#[cfg(test)]
mod tests;

// Parse only the official live-heading fragment. Layout changes fail closed.
fn parse_wbs(body: &str) -> Result<Value, AppError> {
    let heading = body
        .split_once("<li class=\"onair-program-heading\">")
        .ok_or_else(invalid)?
        .1;
    let (heading, rest) = heading.split_once("</li>").ok_or_else(invalid)?;
    if !heading.contains("지금 방송 중") {
        return Err(invalid());
    }
    let title = heading
        .split_once("<div class=\"tit\">")
        .and_then(|(_, s)| s.split_once("</div>"))
        .map(|(s, _)| s.trim())
        .filter(|s| !s.is_empty() && !s.contains(['<', '>', '&']))
        .ok_or_else(invalid)?;
    let line = rest
        .split_once("방송시간 | ")
        .and_then(|(_, s)| s.split_once("</p>"))
        .map(|(s, _)| s.trim())
        .ok_or_else(invalid)?;
    let (days, times) = line.rsplit_once(' ').ok_or_else(invalid)?;
    let (start, end) = times.split_once('~').ok_or_else(invalid)?;
    let weekdays = ['월', '화', '수', '목', '금', '토', '일'];
    let mut selected = Vec::new();
    for part in days.split(',') {
        let chars: Vec<char> = part.trim().chars().collect();
        match chars.as_slice() {
            [day] => selected.push(weekdays.iter().position(|x| x == day).ok_or_else(invalid)?),
            [a, '~', b] => {
                let a = weekdays.iter().position(|x| x == a).ok_or_else(invalid)?;
                let b = weekdays.iter().position(|x| x == b).ok_or_else(invalid)?;
                if a > b {
                    return Err(invalid());
                }
                selected.extend(a..=b)
            }
            _ => return Err(invalid()),
        }
    }
    if time(now().date_naive(), start).is_none() || time(now().date_naive(), end).is_none() {
        return Err(invalid());
    }
    Ok(serde_json::json!({"title":title,"startTime":start,"endTime":end,"days":selected}))
}

fn parse_bbs(body: &str) -> Result<Value, AppError> {
    let title = body
        .split_once("<h4 id=\"ProgramNamePage\">")
        .and_then(|(_, s)| s.split_once("</h4>"))
        .map(|(s, _)| s.trim())
        .filter(|s| !s.is_empty() && !s.contains(['<', '>', '&']))
        .ok_or_else(invalid)?;
    let time = body
        .split_once("id=\"BroadCastTimePage\">")
        .and_then(|(_, s)| s.split_once("</span>"))
        .map(|(s, _)| s.trim().replace('-', "~"))
        .filter(|s| !s.contains(['<', '>', '&']))
        .ok_or_else(invalid)?;
    // Reuse the strict Korean weekday and time parser, without executing page scripts.
    parse_wbs(&format!("<li class=\"onair-program-heading\"><div class=\"tit\">{title}</div>지금 방송 중</li><p>방송시간 | {time}</p>"))
}

fn parse_tbn(body: &str, region: &str) -> Result<Value, AppError> {
    if !body.contains(&format!("onload=javascript:playTbnAlive('{region}');")) {
        return Err(invalid());
    }
    let title = body
        .split_once("<b id=\"forumName\">")
        .and_then(|(_, s)| s.split_once("</b>"))
        .map(|(s, _)| s.trim())
        .filter(|s| !s.is_empty() && !s.contains(['<', '>', '&']))
        .ok_or_else(invalid)?;
    let info = body
        .split_once("<span id=\"mcInfo\"")
        .and_then(|(_, s)| s.split_once('>'))
        .and_then(|(_, s)| s.split_once("</span>"))
        .map(|(s, _)| s)
        .ok_or_else(invalid)?;
    let times = info
        .split_once("방송시간")
        .and_then(|(_, s)| s.split_once(':'))
        .map(|(_, s)| s.trim())
        .ok_or_else(invalid)?;
    let (start, end) = times.split_once('~').ok_or_else(invalid)?;
    let start = start.trim();
    let end = end.trim();
    if time(now().date_naive(), start).is_none() || time(now().date_naive(), end).is_none() {
        return Err(invalid());
    }
    Ok(serde_json::json!({"region":region,"title":title,"startTime":start,"endTime":end}))
}
async fn acquire_request_budget(
    url: &str,
    global: &Arc<tokio::sync::Semaphore>,
    tbn: &Arc<tokio::sync::Semaphore>,
) -> (
    Option<tokio::sync::OwnedSemaphorePermit>,
    tokio::sync::OwnedSemaphorePermit,
) {
    // Acquire the provider budget first: queued TBN regions must not reserve global slots.
    let provider = if url.starts_with("https://www.tbn.or.kr/") {
        Some(
            tbn.clone()
                .acquire_owned()
                .await
                .expect("semaphore remains open"),
        )
    } else {
        None
    };
    let global = global
        .clone()
        .acquire_owned()
        .await
        .expect("semaphore remains open");
    (provider, global)
}
