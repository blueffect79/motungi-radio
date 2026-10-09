// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountApp, safeArtwork } from "../../App";
import { defaults } from "../settings/controller";
const mock = vi.hoisted(() => ({
  invoke: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  resolve: vi.fn(),
  volume: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mock.invoke }));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("../player/transport", () => ({
  HtmlAudioTransport: class {
    start = mock.start;
    stop = mock.stop;
    setVolume = mock.volume;
  },
}));
vi.mock("../player/invoke", () => ({ resolveStream: mock.resolve }));
const stations = [
  ["mbc-mfm", "MBC FM4U"],
  ["sbs-powerpc", "SBS 파워FM"],
  ["tbn-gyeongin", "TBN 경인"],
  ["tbn-busan", "TBN 부산"],
].map(([id, name]) => ({
  id,
  name,
  providerId: id.split("-")[0],
  region: null,
  groupId: id.startsWith("tbn") ? "tbn" : null,
  streamKey: "x",
  officialPageUrl: "https://example.com",
}));
const tick = async () => {
  for (let i = 0; i < 25; i++) await Promise.resolve();
};
let root: HTMLElement,
  dispose: (() => void) | undefined,
  saved = defaults();
beforeEach(() => {
  vi.clearAllMocks();
  saved = { ...defaults(), lastStationId: "mbc-mfm" };
  root = document.createElement("div");
  document.body.append(root);
  mock.invoke.mockImplementation(async (command, args) => {
    if (command === "load_settings") return { ok: true, data: saved };
    if (command === "save_settings") {
      saved = args.settings;
      return { ok: true, data: saved };
    }
    if (command === "list_stations")
      return { ok: true, data: { version: 1, stations } };
    if (command === "get_programs")
      return {
        ok: true,
        data: stations.map((s) => ({
          stationId: s.id,
          status: "available",
          sourceKind: "schedule",
          title: "현재 방송 <script>",
          startsAt: new Date(Date.now() - 3600000).toISOString(),
          endsAt: new Date(Date.now() + 3600000).toISOString(),
          fetchedAt: new Date().toISOString(),
          sourceUrl: "https://example.com",
        })),
      };
    if (command === "get_schedule")
      return {
        ok: true,
        data: {
          stationId: args.stationId,
          entries: [
            {
              title: "다음 프로그램",
              startsAt: new Date(Date.now() + 3600000).toISOString(),
              endsAt: new Date(Date.now() + 7200000).toISOString(),
            },
          ],
          fetchedAt: new Date().toISOString(),
        },
      };
    return { ok: true, data: { enabled: true } };
  });
  mock.resolve.mockImplementation(async (id) => ({
    ok: true,
    data: {
      stationId: id,
      url: "https://example.com/live",
      format: "mp3",
      resolvedAt: "",
    },
  }));
  mock.start.mockImplementation((_s, e) => e.playing());
});
afterEach(() => {
  dispose?.();
  root.remove();
});
function click(label: string) {
  const b = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (b) => b.getAttribute("aria-label") === label,
  );
  expect(b, label).toBeTruthy();
  b!.click();
}
it("restores silently, shows only Gyeongin and safely renders remote text", async () => {
  dispose = await mountApp(root);
  await tick();
  expect(mock.resolve).not.toHaveBeenCalled();
  expect(root.querySelectorAll(".station")).toHaveLength(3);
  expect(root.textContent).not.toContain("TBN 부산");
  expect(root.querySelector("script")).toBeNull();
  expect(root.textContent).toContain("현재 방송 <script>");
  expect(root.querySelector("input[type=range]")).toBeNull();
});
it("keeps playback through settings, schedule and mini transitions", async () => {
  dispose = await mountApp(root);
  await tick();
  click("방송 재생");
  await tick();
  const stops = mock.stop.mock.calls.length;
  click("MBC FM4U 편성표");
  await tick();
  expect(root.querySelector("main")?.textContent).toContain("다음 프로그램");
  click("돌아가기");
  click("미니 플레이어");
  await tick();
  expect(root.querySelector(".shell.mini")).toBeTruthy();
  expect(saved.playerMode).toBe("mini");
  expect(mock.invoke).toHaveBeenCalledWith(
    "set_player_size",
    expect.objectContaining({ mini: true }),
  );
  click("설정");
  await tick();
  expect(mock.invoke).toHaveBeenCalledWith(
    "set_player_size",
    expect.objectContaining({ mini: false }),
  );
  click("돌아가기");
  await tick();
  expect(root.querySelector(".shell.mini")).toBeTruthy();
  expect(mock.stop).toHaveBeenCalledTimes(stops);
});
it("keeps volume DOM and focus through saves and metadata refresh; remembers appearance", async () => {
  dispose = await mountApp(root);
  await tick();
  click("설정");
  await tick();
  const volume = root.querySelector<HTMLInputElement>("input[type=range]")!;
  volume.focus();
  volume.value = "23";
  volume.dispatchEvent(new Event("input"));
  await tick();
  window.dispatchEvent(new Event("focus"));
  await tick();
  expect(root.querySelector("input[type=range]")).toBe(volume);
  expect(document.activeElement).toBe(volume);
  expect(saved.volume).toBe(23);
  click("다크 모드");
  await tick();
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(saved.appearance).toBe("dark");
  click("음소거");
  await tick();
  expect(saved.volume).toBe(0);
  click("음소거");
  await tick();
  expect(saved.volume).toBe(23);
});
it("uses tabs without duplicate favorites, preserving unavailable favorites for removal", async () => {
  saved.favoriteIds = ["mbc-mfm", "tbn-busan", "deleted"];
  dispose = await mountApp(root);
  await tick();
  expect(root.querySelectorAll(".station")).toHaveLength(3);
  click("즐겨찾기");
  expect(root.querySelectorAll(".station")).toHaveLength(3);
  expect(root.textContent).toContain("이용 불가 · 삭제된 채널");
  click("deleted 즐겨찾기 해제");
  await tick();
  expect(saved.favoriteIds).not.toContain("deleted");
});
it("does not let a late schedule response switch channel or reopen a panel", async () => {
  dispose = await mountApp(root);
  await tick();
  const original = mock.invoke.getMockImplementation()!;
  let resolve: any;
  mock.invoke.mockImplementation((c, a) =>
    c === "get_schedule" ? new Promise((r) => (resolve = r)) : original(c, a),
  );
  click("SBS 파워FM 편성표");
  click("돌아가기");
  click("방송 재생");
  await tick();
  click("방송 정지");
  resolve({
    ok: true,
    data: { stationId: "sbs-powerpc", entries: [], fetchedAt: "" },
  });
  await tick();
  expect(root.querySelector("main")?.getAttribute("aria-label")).toBe(
    "방송 목록",
  );
  expect(root.querySelector('[aria-label="방송 재생"]')).toBeTruthy();
  expect(root.querySelector("footer")?.textContent).not.toContain("정지됨");
  expect(mock.resolve).toHaveBeenCalledTimes(1);
});
it("refreshes OS registration and shows failed saves without replacing slider", async () => {
  dispose = await mountApp(root);
  await tick();
  click("설정");
  await tick();
  const original = mock.invoke.getMockImplementation()!;
  mock.invoke.mockImplementation((c, a) =>
    c === "get_autostart"
      ? Promise.resolve({ ok: true, data: { enabled: false } })
      : c === "save_settings"
        ? Promise.resolve({ ok: false, error: { message: "저장 실패" } })
        : original(c, a),
  );
  window.dispatchEvent(new Event("focus"));
  await tick();
  expect(
    root.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked,
  ).toBe(false);
  click("다크 모드");
  await tick();
  expect(root.textContent).toContain("저장 실패");
});
it("shows fallback and retains audio when schedule is unavailable", async () => {
  const original = mock.invoke.getMockImplementation()!;
  mock.invoke.mockImplementation((c, a) =>
    c === "get_schedule" ? Promise.reject(new Error()) : original(c, a),
  );
  dispose = await mountApp(root);
  await tick();
  click("방송 재생");
  await tick();
  const stops = mock.stop.mock.calls.length;
  click("TBN 경인 편성표");
  await tick();
  expect(root.textContent).toContain("다음 프로그램 정보를 확인할 수 없습니다");
  expect(root.querySelector('[aria-label="공식 편성표 확인"]')).toBeTruthy();
  expect(mock.stop).toHaveBeenCalledTimes(stops);
});
it("rejects foreign artwork, credentials and deceptive host names", () => {
  for (const url of [
    "http://img.imbc.com/a",
    "https://img.imbc.com.evil.test/a",
    "https://user@img.imbc.com/a",
    "javascript:alert(1)",
  ])
    expect(safeArtwork(url)).toBeNull();
  expect(safeArtwork("https://img.imbc.com/a.jpg")).toBeTruthy();
});

it("pins without changing playback and publishes actual tray playback state", async () => {
  dispose = await mountApp(root);
  await tick();
  expect(mock.invoke).toHaveBeenCalledWith("set_tray_playing", {
    playing: false,
  });
  expect(root.querySelector('[aria-label="창 숨기기"]')).toBeNull();
  click("플레이어 고정");
  await tick();
  expect(mock.invoke).toHaveBeenCalledWith("set_player_pinned", {
    pinned: true,
  });
  expect(
    root.querySelector('[data-key="pin"]')?.getAttribute("aria-pressed"),
  ).toBe("true");
  click("방송 재생");
  await tick();
  expect(mock.invoke).toHaveBeenCalledWith("set_tray_playing", {
    playing: true,
  });
  click("방송 정지");
  await tick();
  expect(
    mock.invoke.mock.calls
      .filter((c) => c[0] === "set_tray_playing")
      .at(-1)?.[1],
  ).toEqual({ playing: false });
  click("플레이어 고정 해제");
  await tick();
  expect(root.querySelector("header")?.classList.contains("draggable")).toBe(
    false,
  );
});
it("shows past, current and next schedules by date without hiding past programs", async () => {
  const original = mock.invoke.getMockImplementation()!;
  const now = Date.now();
  mock.invoke.mockImplementation((c, a) =>
    c === "get_schedule"
      ? Promise.resolve({
          ok: true,
          data: {
            stationId: a.stationId,
            fetchedAt: new Date(now).toISOString(),
            entries: [
              {
                title: "지난 프로그램",
                startsAt: new Date(now - 7200000).toISOString(),
                endsAt: new Date(now - 3600000).toISOString(),
              },
              {
                title: "현재 프로그램",
                startsAt: new Date(now - 3600000).toISOString(),
                endsAt: new Date(now + 3600000).toISOString(),
              },
              {
                title: "다음 프로그램",
                startsAt: new Date(now + 3600000).toISOString(),
                endsAt: new Date(now + 7200000).toISOString(),
              },
            ],
          },
        })
      : original(c, a),
  );
  dispose = await mountApp(root);
  await tick();
  expect(root.querySelector(".next-program")?.textContent).toContain(
    "다음 프로그램",
  );
  expect(root.querySelector(".program-time")?.textContent).not.toContain(
    "편성표 기준",
  );
  click("현재 채널 편성표");
  await tick();
  expect(root.querySelector(".schedule-row.past")?.textContent).toContain(
    "지난 프로그램",
  );
  expect(root.querySelector(".schedule-row.current")?.textContent).toContain(
    "현재 프로그램",
  );
  expect(root.querySelector('[aria-label="편성표 날짜"]')).toBeTruthy();
});
it("preserves saved volume and removes redundant settings copy", async () => {
  saved.volume = 0;
  dispose = await mountApp(root);
  await tick();
  click("설정");
  await tick();
  expect(root.querySelector<HTMLInputElement>("input[type=range]")?.value).toBe(
    "0",
  );
  expect(root.textContent).not.toContain("내 취향대로");
  expect(root.textContent).not.toContain("OS 등록 상태");
});

it("shows neighboring channel names and switches through the single player", async () => {
  dispose = await mountApp(root);
  await tick();
  const hero = root.querySelector("footer")!;
  expect(hero.querySelector(".current-station")?.textContent).toContain(
    "MBC FM4U ·",
  );
  expect(hero.querySelector(".play-status")).toBeNull();
  click("다음 채널: SBS 파워FM");
  await tick();
  expect(mock.resolve).toHaveBeenLastCalledWith(
    "sbs-powerpc",
    expect.any(AbortSignal),
  );
  expect(hero.querySelector(".current-station")?.textContent).toContain(
    "SBS 파워FM",
  );
  click("이전 채널: MBC FM4U");
  await tick();
  expect(hero.querySelector(".current-station")?.textContent).toContain(
    "MBC FM4U",
  );
  click("이전 채널: TBN 경인");
  await tick();
  expect(hero.querySelector(".current-station")?.textContent).toContain(
    "TBN 경인",
  );
  click("다음 채널: MBC FM4U");
  await tick();
  expect(hero.querySelector(".current-station")?.textContent).toContain(
    "MBC FM4U",
  );
});
