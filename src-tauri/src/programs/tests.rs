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
    let ids: Vec<String> = crate::radio::list_stations()
        .unwrap()
        .stations
        .into_iter()
        .map(|s| s.id)
        .collect();
    let values = rt
        .block_on(get_programs(ids.iter().map(|s| s.to_string()).collect()))
        .unwrap();
    assert_eq!(values.len(), 32);
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
#[test]
fn major_providers_validate_channel_date_and_time() {
    let now = at("2026-10-09T10:50:00+09:00");
    let k = serde_json::json!([{"channel_code":"21","local_station_code":"00","schedules":[{"channel_code":"21","local_station_code":"00","program_planned_date":"20261009","program_planned_start_time":"10050000","program_planned_end_time":"10530000","program_title":"성공예감"}]}]);
    assert_eq!(
        state("kbs-21", Some(&k), now, now).title.as_deref(),
        Some("성공예감")
    );
    assert_eq!(state("kbs-22", Some(&k), now, now).title, None);
    let e = serde_json::json!({"nowProgram":{"channelCode":"RADIO","onairDate":"20261009","title":"클래식","start":"10:00","end":"11:00"}});
    assert_eq!(
        state("ebs-fm", Some(&e), now, now).title.as_deref(),
        Some("클래식")
    );
    assert_eq!(
        state("ebs-fm", Some(&e), now + chrono::Duration::days(1), now).title,
        None
    );
    let s = serde_json::json!({"schedule":{"power":[{"channel":"power","title":"현재","start_time":"10:00","end_time":"11:00","onair_flag":"Y"},{"channel":"power","title":"아님","start_time":"10:00","end_time":"11:00","onair_flag":"N"}]}});
    assert_eq!(
        state("sbs-powerpc", Some(&s), now, now).title.as_deref(),
        Some("현재")
    );
}
#[test]
fn bbs_official_current_heading() {
    let body = r#"<h4 id="ProgramNamePage">거룩한 만남</h4><span class="date" id="BroadCastTimePage">금 10:00-10:55</span>"#;
    let v = parse_bbs(body).unwrap();
    let now = at("2026-10-09T10:50:00+09:00");
    assert_eq!(
        state("bbs-seoul", Some(&v), now, now).title.as_deref(),
        Some("거룩한 만남")
    );
    assert_eq!(
        state("bbs-seoul", Some(&v), now + chrono::Duration::days(1), now).title,
        None
    );
}
#[test]
fn tbn_requires_exact_region_and_valid_live_interval() {
    let b = r#"<body onload=javascript:playTbnAlive('gyeongin');><b id="forumName">스튜디오 1005</b><span id="mcInfo" style="display:block">MC : 진행자 │ 방송시간 : 09:00 ~ 10:55</span>"#;
    let v = parse_tbn(b, "gyeongin").unwrap();
    let now = at("2026-10-09T10:50:00+09:00");
    assert_eq!(
        state("tbn-gyeongin", Some(&v), now, now).title.as_deref(),
        Some("스튜디오 1005")
    );
    assert_eq!(state("tbn-busan", Some(&v), now, now).title, None);
    assert!(parse_tbn(b, "busan").is_err());
    assert_eq!(
        state(
            "tbn-gyeongin",
            Some(&v),
            at("2026-10-09T10:55:00+09:00"),
            now
        )
        .title,
        None
    );
}
#[test]
fn kbs_different_nested_channel_is_not_substituted() {
    let now = at("2026-10-09T10:30:00+09:00");
    let v = serde_json::json!([{"channel_code":"26","local_station_code":"00","schedules":[{"channel_code":"27","local_station_code":"00","program_planned_date":"20261009","program_planned_start_time":"10050000","program_planned_end_time":"11000000","program_title":"다른 채널"}]}]);
    assert_eq!(state("kbs-26", Some(&v), now, now).title, None);
}
#[test]
fn slow_tbn_requests_do_not_starve_fast_broadcasters() {
    let rt = tokio::runtime::Runtime::new().unwrap();
    rt.block_on(async {
        let global = Arc::new(tokio::sync::Semaphore::new(8));
        let tbn = Arc::new(tokio::sync::Semaphore::new(2));
        let mut blocked = tokio::task::JoinSet::new();
        let (started, mut observed) = tokio::sync::mpsc::unbounded_channel();
        for _ in 0..13 {
            let global = global.clone();
            let tbn = tbn.clone();
            let started = started.clone();
            blocked.spawn(async move {
                let _permits = acquire_request_budget(
                    "https://www.tbn.or.kr/onair/tbnlive.tbn?area_code=6",
                    &global,
                    &tbn,
                )
                .await;
                started.send(()).unwrap();
                // Mock a transport that never returns a response.
                std::future::pending::<()>().await;
            });
        }
        observed.recv().await.unwrap();
        observed.recv().await.unwrap();
        tokio::time::sleep(Duration::from_millis(10)).await;
        let fast = tokio::time::timeout(Duration::from_millis(100), async {
            let _permits = acquire_request_budget(
                "https://miniapi.imbc.com/Schedule/schedulelist",
                &global,
                &tbn,
            )
            .await;
            // A healthy mock transport responds immediately while TBN remains blocked.
            serde_json::json!({"title":"정상 방송사 응답"})
        })
        .await;
        blocked.abort_all();
        while blocked.join_next().await.is_some() {}
        assert_eq!(
            fast.expect("TBN must not monopolize global request slots")["title"],
            "정상 방송사 응답"
        );
        assert_eq!(global.available_permits(), 8);
        assert_eq!(tbn.available_permits(), 2);
    });
}

#[test]
fn future_schedule_includes_tomorrow_without_extrapolating_live_sources() {
    let v = serde_json::json!([
        {"Channel":"FM4U","LiveDays":"금","StartTime":"2300","EndTime":"2400","ProgramTitle":"오늘 마지막"},
        {"Channel":"FM4U","LiveDays":"토","StartTime":"0000","EndTime":"0100","ProgramTitle":"내일 첫 방송"}
    ]);
    let entries = schedule_entries("mbc-mfm", &v, at("2026-10-09T23:30:00+09:00"));
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[1].title, "내일 첫 방송");
    assert!(entries[1].starts_at.starts_with("2026-10-10"));
    assert!(schedule_entries(
        "febc-seoul",
        &serde_json::json!({"title":"live","startTime":"2300","endTime":"2400"}),
        at("2026-10-09T23:30:00+09:00")
    )
    .is_empty());
}
#[test]
fn sbs_future_flag_and_artwork_host_are_validated() {
    let v = serde_json::json!({"schedule":{"power":[
        {"channel":"power","onair_flag":"Y","start_time":"1000","end_time":"1100","title":"현재","image":"https://image.cloud.sbs.co.kr/current.png"},
        {"channel":"power","onair_flag":"N","start_time":"1100","end_time":"1200","title":"다음","image":"https://image.cloud.sbs.co.kr.evil.test/a.png"}
    ]}});
    let entries = schedule_entries("sbs-powerpc", &v, at("2026-10-09T10:30:00+09:00"));
    assert_eq!(entries.len(), 2);
    assert!(entries[0].image_url.is_some());
    assert!(entries[1].image_url.is_none());
    assert_eq!(
        state(
            "sbs-powerpc",
            Some(&v),
            at("2026-10-09T10:30:00+09:00"),
            at("2026-10-09T10:30:00+09:00")
        )
        .title
        .as_deref(),
        Some("현재")
    );
    let envelope = serde_json::to_value(&entries[0]).unwrap();
    assert!(envelope.get("startsAt").is_some());
    assert!(envelope.get("imageUrl").is_some());
}
#[test]
fn conflicting_schedule_does_not_guess_next_program() {
    let v = serde_json::json!([
        {"Channel":"FM4U","LiveDays":"금","StartTime":"1000","EndTime":"1200","ProgramTitle":"A"},
        {"Channel":"FM4U","LiveDays":"금","StartTime":"1100","EndTime":"1300","ProgramTitle":"B"}
    ]);
    assert!(schedule_entries("mbc-mfm", &v, at("2026-10-09T10:30:00+09:00")).is_empty());
}
#[test]
#[ignore = "live official schedule and artwork probe"]
fn live_schedules() {
    tauri::async_runtime::block_on(async {
        for id in ["mbc-mfm", "sbs-powerpc", "cbs-music", "kbs-24"] {
            let result = get_schedule(id.into()).await.unwrap();
            println!("{}: {} schedule entries", id, result.entries.len());
            if id == "mbc-mfm" || id == "sbs-powerpc" {
                assert!(result.entries.len() > 1);
            }
        }
    });
}

#[test]
fn date_schedule_retains_past_programs_of_today() {
    let v = serde_json::json!([
        {"Channel":"FM4U","LiveDays":"금","StartTime":"0900","EndTime":"1000","ProgramTitle":"지난 방송"},
        {"Channel":"FM4U","LiveDays":"금","StartTime":"1000","EndTime":"1100","ProgramTitle":"현재 방송"},
        {"Channel":"FM4U","LiveDays":"금","StartTime":"1100","EndTime":"1200","ProgramTitle":"다음 방송"}
    ]);
    let entries = schedule_entries("mbc-mfm", &v, at("2026-10-09T10:30:00+09:00"));
    assert_eq!(entries.len(), 3);
    assert_eq!(entries[0].title, "지난 방송");
    assert_eq!(entries[2].title, "다음 방송");
}

#[test]
fn kbs_artwork_matches_exact_channel_region_and_title() {
    let image = "https://programres.kbs.co.kr/r2025-0079/2025/6/25/1750810544504_590060.jpg";
    let mut data = serde_json::json!([
        {"channel_code":"21","local_station_code":"00","schedules":[
            {"channel_code":"21","local_station_code":"00","program_title":"같은 제목","image_w":"https://programres.kbs.co.kr/wrong.jpg"}]},
        {"channel_code":"22","local_station_code":"00","schedules":[
            {"channel_code":"22","local_station_code":"00","program_title":"같은 제목","image_w":image}]}
    ]);
    assert_eq!(
        artwork("kbs-22", &data, "같은 제목").as_deref(),
        Some(image)
    );
    assert_eq!(artwork("kbs-22", &data, "다른 제목"), None);
    for rejected in [
        "https://programres.kbs.co.kr.evil.test/x.jpg",
        "http://programres.kbs.co.kr/x.jpg",
        "https://user@programres.kbs.co.kr/x.jpg",
        "https://programres.kbs.co.kr:8443/x.jpg",
    ] {
        data[1]["schedules"][0]["image_w"] = serde_json::json!(rejected);
        assert_eq!(artwork("kbs-22", &data, "같은 제목"), None);
    }
    data[1]["schedules"][0]["image_w"] = serde_json::json!(
        "https://mediafactory.play.kbs.co.kr/upload/radioImage/Program/test.jpeg"
    );
    assert!(artwork("kbs-22", &data, "같은 제목").is_some());
    data[1]["schedules"][0]["local_station_code"] = serde_json::json!("10");
    assert_eq!(artwork("kbs-22", &data, "같은 제목"), None);
}

#[test]
#[ignore = "live official KBS artwork probe"]
fn live_kbs_artwork() {
    tauri::async_runtime::block_on(async {
        let values = get_programs((21..=26).map(|code| format!("kbs-{code}")).collect())
            .await
            .unwrap();
        let mut images = 0;
        for value in values {
            let has_image = value.image_url.is_some();
            println!("{}: image={}", value.station_id, has_image);
            images += usize::from(has_image);
        }
        assert!(images > 0, "no current KBS artwork found");
    });
}

#[test]
fn cbs_artwork_is_channel_scoped_and_rejects_untrusted_paths() {
    let mut v = serde_json::json!({"musicfm":[{"name":"동행","program":{"image":{
        "radioProfil":"/data/cbs/upload/save/program/profile.png",
        "mobileTop":"/data/cbs/upload/save/program/mobile.png"
    }}}]});
    assert_eq!(
        artwork("cbs-music", &v, "동행").as_deref(),
        Some("https://cbs.co.kr/data/cbs/upload/save/program/profile.png")
    );
    assert!(artwork("cbs-standard", &v, "동행").is_none());
    assert!(artwork("cbs-music", &v, "다른 프로그램").is_none());
    for bad in [
        "",
        "//evil.test/a.png",
        "https://cbs.co.kr.evil.test/a.png",
        "http://cbs.co.kr/data/cbs/upload/save/program/a.png",
        "/data/cbs/upload/save/program/../secret.png",
    ] {
        v["musicfm"][0]["program"]["image"]["radioProfil"] = bad.into();
        assert_eq!(
            artwork("cbs-music", &v, "동행").as_deref(),
            Some("https://cbs.co.kr/data/cbs/upload/save/program/mobile.png")
        );
    }
    v["musicfm"][0]["program"] = Value::Null;
    assert!(artwork("cbs-music", &v, "동행").is_none());
}

#[test]
#[ignore = "live official CBS artwork probe"]
fn live_cbs_artwork() {
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        let value = fetch("https://cbs.co.kr/schedule/all/ajax").await.unwrap();
        for (id, key) in [
            ("cbs-standard", "fm"),
            ("cbs-music", "musicfm"),
            ("cbs-joy4u", "joy4u"),
        ] {
            assert!(
                value[key].as_array().unwrap().iter().any(|row| artwork(
                    id,
                    &value,
                    cbs_title(row)
                )
                .is_some()),
                "{id}"
            );
        }
    });
}

#[test]
fn artwork_uses_official_nested_images_and_exact_channel() {
    let v = serde_json::json!({"schedule":{"power":[{"channel":"power","title":"방송",
        "onair":{"image":"https://image.cloud.sbs.co.kr/cover.png"}}],
        "love":[{"channel":"love","title":"방송","onair":{"image":"https://evil.test/a"}}]}});
    assert_eq!(
        artwork("sbs-powerpc", &v, "방송").as_deref(),
        Some("https://image.cloud.sbs.co.kr/cover.png")
    );
    assert!(artwork("sbs-lovepc", &v, "방송").is_none());
    assert!(artwork("sbs-powerpc", &v, "다른 방송").is_none());
    let v = serde_json::json!([
        {"Channel":"STFM","ProgramTitle":"방송","MiniAppPicture":"https://img.imbc.com/wrong.jpg"},
        {"Channel":"FM4U","ProgramTitle":"방송","MiniAppPicture":"https://img.imbc.com/large.jpg","ThumbnailPicture":"https://img.imbc.com/small.jpg"}]);
    assert_eq!(
        artwork("mbc-mfm", &v, "방송").as_deref(),
        Some("https://img.imbc.com/large.jpg")
    );
}

#[test]
fn additional_artwork_rejects_cross_host_and_wrong_program() {
    let mut v = serde_json::json!({"title":"방송","poster":"/fileupload/program.png"});
    assert_eq!(
        artwork("febc-seoul", &v, "방송").as_deref(),
        Some("https://seoul.febc.net/fileupload/program.png")
    );
    assert!(artwork("febc-seoul", &v, "다른 방송").is_none());
    for url in [
        "https://evil.test/a",
        "//evil.test/a",
        "https://user@seoul.febc.net/a",
        "https://seoul.febc.net/a#fragment",
    ] {
        v["poster"] = serde_json::json!(url);
        assert!(artwork("febc-seoul", &v, "방송").is_none());
    }
    let v = serde_json::json!({"onair":{"info":{"channelid":"radio","title":"방송","program_image":"https://img.cpbc.co.kr/a.png"}}});
    assert!(artwork("cpbc-seoul", &v, "방송").is_some());
}

#[test]
fn ebs_artwork_requires_radio_and_official_course_path() {
    let mut v = serde_json::json!({"nowProgram":{"channelCode":"RADIO","title":"경청","thumbnail9":"/public/courses/cover.png"}});
    assert_eq!(
        artwork("ebs-fm", &v, "경청").as_deref(),
        Some("https://static.ebs.co.kr/images/public/courses/cover.png")
    );
    v["nowProgram"]["channelCode"] = serde_json::json!("TV");
    assert!(artwork("ebs-fm", &v, "경청").is_none());
}

#[test]
fn sbs_prefers_square_program_cover_over_cutout_presenter() {
    let v = serde_json::json!({"schedule":{"power":[{"channel":"power","title":"방송","hom_url":"https://programs.sbs.co.kr/radio/show",
        "onair":{"image":"https://image.cloud.sbs.co.kr/cutout.png"}}]},
        "main_clip":[{"image_alt":"방송","link_url":"https://programs.sbs.co.kr/radio/show","image_square":"https://image.cloud.sbs.co.kr/square.jpg"}]});
    assert_eq!(
        artwork("sbs-powerpc", &v, "방송").as_deref(),
        Some("https://image.cloud.sbs.co.kr/square.jpg")
    );
}

#[test]
fn wbs_embedded_schedule_and_bbs_poster_are_extracted_without_scripts() {
    let at = now();
    let rows = serde_json::json!({"items":[{"start":(at-chrono::Duration::minutes(20)).timestamp_millis(),
        "end":(at+chrono::Duration::minutes(20)).timestamp_millis(),"title":"현재 방송","image":"/data/file/gr_image/a.jpg"}]});
    let html =
        format!("<script type=\"application/json\" class=\"wbs-onair-day-data\">{rows}</script>");
    let v = parse_wbs(&html).unwrap();
    assert_eq!(
        artwork("wbs-seoul", &v, "현재 방송").as_deref(),
        Some("https://wbsi.kr/data/file/gr_image/a.jpg")
    );
    let v = parse_bbs("<video id=\"main-player\" poster=\"https://m.bbsi.co.kr/M/UploadProgramImg/a.jpg\"></video><h4 id=\"ProgramNamePage\">방송</h4><span id=\"BroadCastTimePage\">월-금 21:00-23:00</span>").unwrap();
    assert!(artwork("bbs-seoul", &v, "방송").is_some());
}
