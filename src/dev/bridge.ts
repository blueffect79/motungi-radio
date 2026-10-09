/** Development-only adapter. Vite substitutes this only when serving in ui-preview mode. */
import snapshot from "./metadata.json";
let settings = {
  schemaVersion: 1,
  volume: 100,
  lastStationId: "mbc-mfm",
  tbnStationId: null,
  favoriteIds: ["mbc-mfm", "sbs-powerpc", "cbs-music"],
  appearance: "light",
  playerMode: "full",
};
export async function invoke(command: string, args: any = {}): Promise<any> {
  if (command === "load_settings") return { ok: true, data: settings };
  if (command === "save_settings") {
    settings = args.settings;
    return { ok: true, data: settings };
  }
  if (command === "list_stations") return { ok: true, data: snapshot.catalog };
  if (command === "get_programs") return { ok: true, data: snapshot.programs };
  if (command === "get_schedule")
    return {
      ok: true,
      data:
        args.stationId === "mbc-mfm"
          ? snapshot.schedule
          : {
              stationId: args.stationId,
              entries: [],
              fetchedAt: new Date().toISOString(),
            },
    };
  if (command === "get_autostart" || command === "set_autostart")
    return { ok: true, data: { enabled: false } };
  if (command === "set_player_size") {
    document.documentElement.style.setProperty(
      "--preview-height",
      args.mini ? `${args.height ?? 240}px` : "640px",
    );
    return;
  }
  if (
    ["set_player_pinned", "start_player_drag", "set_tray_playing"].includes(
      command,
    )
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
