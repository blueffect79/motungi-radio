/** Development-only adapter. Vite substitutes this only when serving in ui-preview mode. */
import snapshot from "./metadata.json";
// Explicit development fixture for overflow QA, never used by a packaged app.
const longTitles = new URLSearchParams(location.search).has("long-titles");
const fixtureTitle =
  "긴 제목 검증 · 김이나의 별이 빛나는 밤에 특별한 이야기와 함께하는 음악 여행";
const fixtureNow = Date.now();
const catalog = longTitles
  ? {
      ...snapshot.catalog,
      stations: snapshot.catalog.stations.map((s) => ({
        ...s,
        name: `${s.name} · 긴 채널명 화면 검증`,
      })),
    }
  : snapshot.catalog;
const sample = new URLSearchParams(location.search).has("sample");
const programs = (longTitles || sample)
  ? snapshot.programs.map((p) => ({
      ...p,
      status: "available",
      title: longTitles ? fixtureTitle : p.title,
      startsAt: new Date(fixtureNow - 1800000).toISOString(),
      endsAt: new Date(fixtureNow + 1800000).toISOString(),
    }))
  : snapshot.programs;
const schedule = longTitles
  ? {
      ...snapshot.schedule,
      fetchedAt: new Date(fixtureNow).toISOString(),
      entries: [-1, 0, 1].map((offset) => ({
        title: fixtureTitle,
        startsAt: new Date(
          fixtureNow - 1800000 + offset * 3600000,
        ).toISOString(),
        endsAt: new Date(fixtureNow + 1800000 + offset * 3600000).toISOString(),
        imageUrl: null,
      })),
    }
  : snapshot.schedule;
let settings = {
  schemaVersion: 1,
  analyticsEnabled: false,
  volume: 100,
  lastStationId: "mbc-mfm",
  tbnStationId: null,
  channelOrder: [],
  disabledChannelIds: [],
  appearance: "light",
  playerMode: "full",
};
export async function invoke(command: string, args: any = {}): Promise<any> {
  if (command === "prepare_update") return {version: null, supported: true};
  if (command === "install_update") throw new Error("미리보기에서는 설치하지 않습니다.");
  if (command === "load_settings") return { ok: true, data: settings };
  if (command === "save_settings") {
    settings = args.settings;
    return { ok: true, data: settings };
  }
  if (command === "list_stations") return { ok: true, data: catalog };
  if (command === "get_programs") return { ok: true, data: programs };
  if (command === "get_schedule")
    return {
      ok: true,
      data:
        args.stationId === "mbc-mfm"
          ? schedule
          : {
              stationId: args.stationId,
              entries: [],
              fetchedAt: new Date().toISOString(),
            },
    };
  if (command === "get_autostart" || command === "set_autostart")
    return { ok: true, data: { enabled: false } };
  if (command === "set_player_size") {
    document.documentElement.style.setProperty("--preview-width", args.miniPlayer ? "320px" : "380px");
    document.documentElement.style.setProperty(
      "--preview-height",
      args.mini ? `${args.height ?? 240}px` : "640px",
    );
    return;
  }
  if (command === "set_player_opacity") {
    document.querySelector<HTMLElement>(".shell")!.style.opacity = String(
      args.percent / 100,
    );
    return;
  }
  if (
    [
      "set_tray_state",
      "set_player_pinned",
      "start_player_drag",
      "set_tray_playing",
    ].includes(command)
  )
    return;
  if (command === "resolve_stream")
    return {
      ok: false,
      error: {
        code: "unavailable",
        message: "화면 검증 모드에서는 오디오를 재생하지 않습니다.",
        retryable: false,
      },
    };
  if (command === "cancel_resolve_stream") return;
  throw new Error("Unavailable in UI preview");
}
