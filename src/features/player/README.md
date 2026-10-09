# 플레이어 연결

앱 전체에서 `PlayerController`, `HtmlAudioTransport`, 절전복귀 감지 연결을 각각 한 번만 만듭니다.

```ts
const player = new PlayerController({
  transport: new HtmlAudioTransport(),
  resolve: resolveStream,
  persist: patch => { /* 설정 변경만 저장합니다. 방송 URL은 저장하지 않습니다. */ },
});
player.restore(settings.lastStationId, settings.volume); // 자동 재생하지 않습니다.
const unsubscribe = player.subscribe(renderPlayback);
const unbindLifecycle = bindPlaybackLifecycle(player);
```

행 선택은 `player.select(station.id)`, 재생은 `player.play()`, 수동 재시도는 `player.retry()`, 정지는 `player.stop()`, 볼륨은 `player.setVolume(value)`를 호출합니다. 볼륨 범위는 0–100이고 기본값은 50입니다. 앱 종료 때만 `unbindLifecycle(); unsubscribe(); player.dispose()`를 실행합니다. 창을 숨기는 동작은 종료가 아닙니다.

상태는 공통 `Playback` 계약을 사용합니다. 볼륨이 0이어도 실제 미디어 `playing` 이벤트를 받으면 재생 상태입니다. URL 응답 성공만으로 재생 상태를 표시하지 않습니다. 매 재생·재시도·절전복귀 때 주소를 새로 요청합니다. 자동 재연결 타이머는 없고, hls.js의 조각·목록 요청 재시도만 각 1회로 제한합니다. 최종 실패는 오류와 수동 재시도로 표시합니다. 최초 미디어 시작 및 재버퍼링은 20초 제한을 두며, 실제 `playing` 이벤트가 오면 제한 타이머를 해제합니다. 반복 `waiting` 이벤트는 제한 시간을 연장하지 않습니다. 시간 초과는 재생을 정리하고 수동 재시도 가능한 `timeout` 오류로 표시합니다. 정지·채널 교체·앱 종료 시 이전 타이머도 해제합니다.

`bindPlaybackLifecycle`는 네트워크 online 이벤트와 네이티브 `system-resumed` 이벤트를 구독합니다. macOS는 NSWorkspace 전용 알림 센터의 `NSWorkspaceDidWakeNotification`, Windows는 `PowerRegisterSuspendResumeNotification`의 `PBT_APMRESUMEAUTOMATIC`을 연결합니다. Windows의 뒤따르는 `RESUMESUSPEND` 알림은 중복 재연결을 막기 위해 무시합니다. 별도 권한이나 절전 방지 설정은 필요하지 않습니다. 포커스·창 표시·숨김·타이머 실행 공백은 재연결을 일으키지 않습니다. 정지한 상태에서는 복귀 이벤트도 재생하지 않습니다. 종료 시 OS 알림과 프런트 이벤트 구독을 해제하며, 늦게 완료된 구독도 즉시 해제합니다. 30–60초 절전 및 장기 절전 후 실제 재생은 Mac과 Windows PC에서 수동 검증해야 합니다.

공식 API 근거: [Apple NSWorkspace.didWakeNotification](https://developer.apple.com/documentation/appkit/nsworkspace/didwakenotification), [Microsoft PowerRegisterSuspendResumeNotification](https://learn.microsoft.com/windows/win32/api/powerbase/nf-powerbase-powerregistersuspendresumenotification).

## 네이티브 등록

`lib.rs`에서 `playback` 모듈을 등록하고 `playback::Resolver::default()`를 managed state로 연결합니다. 두 명령을 등록합니다.

```rust
#[tauri::command]
async fn resolve_stream(
    station_id: String,
    request_id: u64,
    state: tauri::State<'_, playback::Resolver>,
) -> radio::ApiResult<radio::ResolvedStream> {
    state.resolve(&station_id, request_id).await.into()
}

#[tauri::command]
fn cancel_resolve_stream(request_id: u64, state: tauri::State<'_, playback::Resolver>) {
    state.cancel(request_id);
}
```

JS 내부 명령 인자는 `resolve_stream({stationId, requestId})`, `cancel_resolve_stream({requestId})`입니다. 공개 데이터 모델과 결과 계약은 그대로입니다. 어댑터는 매 요청마다 증가하는 ID를 발급합니다. 초기 ID는 현재 시각을 사용하여 일반적인 웹뷰 새로고침에도 증가하도록 합니다.

네이티브는 가장 큰 요청 ID를 취소 기록으로 유지합니다. 이전 요청의 늦은 취소는 같은 ID의 작업만 중단합니다. 취소가 시작보다 먼저 도착하거나, 예전 시작이 최신 시작보다 늦게 도착해도 이전 작업은 되살아나지 않습니다. 취소된 reqwest future는 실제로 drop됩니다. JS의 세대 검사도 늦은 결과·미디어 이벤트를 차단합니다. 토큰 URL은 상태·설정·로그에 남기지 않습니다.

## 검증 범위

TS 단위 테스트는 가짜 미디어를 사용합니다. 네이티브 취소 테스트는 실제 tokio 라이브러리와 가짜 radio 모듈을 연결한 임시 rustc 실행 파일로 검증했습니다. 부모 모듈 등록 후 전체 cargo 테스트가 필요합니다. 실제 macOS native HLS와 Windows MSE 재생은 각 호스트에서 추가 검증해야 합니다.
