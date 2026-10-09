use super::*;
fn at(s: &str) -> DateTime<FixedOffset> {
    DateTime::parse_from_rfc3339(s).unwrap()
}
fn mbc(days: &str, start: &str, end: &str, title: &str) -> Value {
    serde_json::json!([{"Channel":"STFM","LiveDays":days,"StartTime":start,"EndTime":end,"ProgramTitle":title}])
}
#[test]
fn midnight_weekday_and_boundaries() {
    let v = mbc("목", "2300", "0100", "심야");
    assert_eq!(
        parse("mbc-sfm", &v, at("2026-10-09T00:30:00+09:00")).len(),
        1
    );
    assert_eq!(
        parse("mbc-sfm", &v, at("2026-10-09T01:00:00+09:00")).len(),
        0
    );
    assert_eq!(
        parse("mbc-sfm", &v, at("2026-10-08T23:00:00+09:00")).len(),
        1
    );
    assert_eq!(
        parse("mbc-sfm", &v, at("2026-10-10T00:30:00+09:00")).len(),
        0
    );
}
#[test]
fn invalid_empty_overlap_and_channel_isolation() {
    let now = at("2026-10-09T10:00:00+09:00");
    for v in [
        mbc("금", "1000", "1100", ""),
        mbc("금", "2500", "2600", "bad"),
        serde_json::json!([]),
    ] {
        assert!(parse("mbc-sfm", &v, now).is_empty());
    }
    let mut v = mbc("금", "1000", "1100", "one");
    let second = v[0].clone();
    v.as_array_mut().unwrap().push(second);
    assert_eq!(state("mbc-sfm", Some(&v), now, now).status, "unavailable");
    assert_eq!(state("mbc-sfm", None, now, now).title, None);
    assert_eq!(state("mbc-mfm", Some(&v), now, now).title, None);
}
#[test]
fn failure_backoff_and_cache_boundary() {
    let now = at("2026-10-09T10:00:00+09:00");
    let v = mbc("금", "1000", "1001", "one");
    assert_eq!(
        next_refresh(Some(&v), &["mbc-sfm"], now, 0),
        now + chrono::Duration::minutes(1)
    );
    assert_eq!(
        next_refresh(None, &["mbc-sfm"], now, 2),
        now + chrono::Duration::seconds(60)
    );
}
#[test]
fn cbs_official_name_fallback_and_expired_date() {
    let now = at("2026-10-09T10:00:00+09:00");
    let v = serde_json::json!({"fm":[{"date":"2026-10-09","startTime":"10:00","endTime":"11:00","title":null,"name":"공식 이름"}],"musicfm":[{"date":"2026-10-08","startTime":"10:00","endTime":"11:00","name":"어제"}]});
    assert_eq!(
        state("cbs-standard", Some(&v), now, now).title.as_deref(),
        Some("공식 이름")
    );
    assert_eq!(state("cbs-music", Some(&v), now, now).status, "unavailable");
}
#[test]
fn live_requires_channel_and_time_and_regions_are_not_substituted() {
    let now = at("2026-10-09T10:00:00+09:00");
    let v = serde_json::json!({"onair":{"info":{"channelid":"RADIO","title":"현재 방송","starttime":"10:00","endtime":"11:00"}}});
    assert_eq!(
        state("cpbc-seoul", Some(&v), now, now)
            .source_kind
            .as_deref(),
        Some("live")
    );
    assert_eq!(state("tbn-busan", Some(&v), now, now).title, None);
    assert_eq!(
        state(
            "cpbc-seoul",
            Some(&v),
            now + chrono::Duration::hours(1),
            now
        )
        .title,
        None
    );
}
#[test]
fn rejects_untrusted_source_urls() {
    for raw in [
        "http://cbs.co.kr/a",
        "https://cbs.co.kr.evil.test/a",
        "https://user@cbs.co.kr/a",
        "https://cbs.co.kr:444/a",
    ] {
        assert!(!valid_url(&url::Url::parse(raw).unwrap()))
    }
}
#[test]
#[ignore = "live official metadata probe"]
fn live_programs() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let ids = vec![
        "mbc-sfm",
        "mbc-mfm",
        "mbc-chm",
        "cbs-standard",
        "cbs-music",
        "cbs-joy4u",
        "cpbc-seoul",
        "febc-seoul",
        "wbs-seoul",
    ];
    let values = rt
        .block_on(get_programs(ids.iter().map(|s| s.to_string()).collect()))
        .unwrap();
    assert_eq!(values.len(), 9);
    for s in values {
        eprintln!(
            "{} {} {:?} {:?} {:?}",
            s.station_id, s.status, s.title, s.starts_at, s.ends_at
        );
    }
}
#[test]
fn concurrent_requests_share_fetch_and_failure_discards_previous_body() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let shared = Arc::new(Mutex::new(None));
        let count = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let mut handles = Vec::new();
        for _ in 0..2 {
            let shared = shared.clone();
            let count = count.clone();
            handles.push(tokio::spawn(async move {
                cached(&shared, &["mbc-sfm"], || async {
                    count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(10)).await;
                    Some(serde_json::json!([]))
                })
                .await
            }));
        }
        for h in handles {
            assert!(h.await.unwrap().0.is_some())
        }
        assert_eq!(count.load(std::sync::atomic::Ordering::SeqCst), 1);
        shared.lock().await.as_mut().unwrap().next = now() - chrono::Duration::seconds(1);
        assert!(cached(&shared, &["mbc-sfm"], || async { None })
            .await
            .0
            .is_none());
        assert!(cached(&shared, &["mbc-sfm"], || async {
            panic!("failure backoff must not fetch")
        })
        .await
        .0
        .is_none());
    });
}
#[test]
fn wbs_heading_and_weekday_range_are_required() {
    let body = r#"<li class="onair-program-heading"><div class="tit">노래하나 추억 둘</div><span>지금 방송 중</span></li><p>방송시간 | 월~일 09:00~11:00</p>"#;
    let v = parse_wbs(body).unwrap();
    let now = at("2026-10-09T10:00:00+09:00");
    assert_eq!(
        state("wbs-seoul", Some(&v), now, now).title.as_deref(),
        Some("노래하나 추억 둘")
    );
    assert_eq!(
        state("wbs-seoul", Some(&v), at("2026-10-09T11:00:00+09:00"), now).title,
        None
    );
    assert_eq!(
        state(
            "wbs-seoul",
            Some(&parse_wbs(&body.replace("월~일", "토~일")).unwrap()),
            now,
            now
        )
        .title,
        None
    );
    assert!(parse_wbs(&body.replace("지금 방송 중", "지난 방송")).is_err());
    assert!(parse_wbs(&body.replace("09:00~11:00", "알 수 없음")).is_err());
}
