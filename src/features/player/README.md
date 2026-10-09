# Player integration

Create exactly one `PlayerController`, `HtmlAudioTransport`, and lifecycle binding for the application:

```ts
const player = new PlayerController({
  transport: new HtmlAudioTransport(),
  resolve: resolveStream,
  persist: patch => { /* enqueue settings patch; never save resolved URLs */ },
});
player.restore(settings.lastStationId, settings.volume); // never autoplay
const unsubscribe = player.subscribe(renderPlayback);
const unbindLifecycle = bindPlaybackLifecycle(player);
```

Row click: `player.select(station.id)`. Play / manual retry: `player.play()` / `player.retry()`. Stop: `player.stop()`. Volume: `player.setVolume(value)` (0–100). Clean up only at application teardown: `unbindLifecycle(); unsubscribe(); player.dispose()`. Hiding the window is not teardown. `state` has the shared `Playback` shape; actual media `playing` events alone set playing, including at volume zero.

Every play/retry/wake uses a new resolver request. No automatic retry timer is scheduled. hls.js segment/manifest/level request retries are limited to one; fatal failure exposes error and manual retry. `bindPlaybackLifecycle` listens for online and a >90-second wall clock scheduling gap, not focus or visibility. This is best-effort wake detection, not an OS power event: heavy scheduling throttling can be mistaken for sleep. For exact OS wake notifications, call `player.resume()` from the native event instead.

Native integration required in `lib.rs`: register `playback` module, manage `playback::Resolver::default()`, make existing `resolve_stream(station_id, state: State<playback::Resolver>)` call `state.resolve(&station_id).await.into()`, and register `cancel_resolve_stream(state)` calling `state.cancel()`. The existing resolve command's JS payload stays `{stationId}`. Cancellation drops pending reqwest work. JS request generation checks additionally reject stale results/events. Neither state nor settings stores URLs.

Native cancellation tests were run with a temporary standalone rustc harness using the production tokio rlib and a stub radio resolver; run full cargo tests after registering the module. Browser unit tests use fake media; actual macOS native HLS and Windows MSE playback still need host validation.
