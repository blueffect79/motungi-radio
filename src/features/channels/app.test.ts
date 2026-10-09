// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mountApp } from "../../App";
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
const stations = Array.from({ length: 13 }, (_, i) => ({
  id: `tbn-${i}`,
  name: `TBN ${i}`,
  region: `지역 ${i}`,
  groupId: "tbn",
  providerId: "tbn",
  streamKey: "x",
  officialPageUrl: "https://example.com",
}));
const tick = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
let root: HTMLElement, dispose: (() => void) | undefined;
let saved = defaults();
beforeEach(() => {
  vi.clearAllMocks();
  saved = { ...defaults(), lastStationId: "tbn-0" };
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
      return { ok: false, error: { message: "fail" } };
    if (command === "get_autostart")
      return { ok: true, data: { enabled: true } };
    return { ok: true, data: { enabled: false } };
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
  const button = Array.from(
    root.querySelectorAll<HTMLButtonElement>("button"),
  ).find((b) => b.getAttribute("aria-label") === label);
  expect(button, label).toBeTruthy();
  button!.click();
}
it("renders one TBN group, thirteen region programs, silent restore and safe remote text", async () => {
  stations[0].name = "<img src=x onerror=alert(1)>";
  dispose = await mountApp(root);
  await tick();
  expect(mock.resolve).not.toHaveBeenCalled();
  expect(root.querySelectorAll(".station")).toHaveLength(1);
  expect(root.querySelector("img")).toBeNull();
  click("TBN 지역 선택");
  expect(root.querySelectorAll(".regions button")).toHaveLength(13);
  expect(root.querySelectorAll(".regions .program")).toHaveLength(13);
  click("TBN 2 지역 선택");
  await tick();
  expect(mock.resolve).not.toHaveBeenCalled();
  expect(saved.tbnStationId).toBe("tbn-2");
  expect(root.querySelector("footer")?.textContent).toContain("정지됨");
  stations[0].name = "TBN 0";
});
it("switches playing TBN region, leaves stopped audio alone and does not stop on info failure", async () => {
  dispose = await mountApp(root);
  await tick();
  click("방송 재생");
  await tick();
  expect(mock.resolve).toHaveBeenLastCalledWith(
    "tbn-0",
    expect.any(AbortSignal),
  );
  const stops = mock.stop.mock.calls.length;
  window.dispatchEvent(new Event("focus"));
  await tick();
  expect(mock.stop).toHaveBeenCalledTimes(stops);
  click("TBN 지역 선택");
  click("TBN 3 지역 선택");
  await tick();
  expect(mock.resolve).toHaveBeenLastCalledWith(
    "tbn-3",
    expect.any(AbortSignal),
  );
  click("방송 정지");
  await tick();
  const count = mock.resolve.mock.calls.length;
  click("TBN 4 지역 선택");
  await tick();
  expect(mock.resolve).toHaveBeenCalledTimes(count);
  expect(root.querySelector("footer")?.textContent).toContain("TBN 3");
});
it("renders two region favorites and lets users remove a deleted favorite", async () => {
  saved.favoriteIds = ["tbn-1", "tbn-2", "deleted"];
  saved.lastStationId = "removed";
  dispose = await mountApp(root);
  await tick();
  expect(root.querySelectorAll(".station")).toHaveLength(4);
  expect(root.textContent).toContain("removed · 마지막 채널 이용 불가");
  click("deleted 즐겨찾기 해제");
  await tick();
  expect(saved.favoriteIds).toEqual(["tbn-1", "tbn-2"]);
  click("설정");
  await tick();
  expect(
    root.querySelector<HTMLInputElement>("input[type=checkbox]")?.checked,
  ).toBe(true);
});
it("keeps the same volume control and keyboard focus across metadata and save renders", async () => {
  dispose = await mountApp(root);
  await tick();
  const volume = root.querySelector<HTMLInputElement>("input[type=range]")!;
  volume.focus();
  volume.value = "23";
  volume.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  window.dispatchEvent(new Event("focus"));
  await tick();
  expect(root.querySelector("input[type=range]")).toBe(volume);
  expect(document.activeElement).toBe(volume);
  expect(saved.volume).toBe(23);
});
it("region selection while another broadcaster plays does not stop or change its audio", async () => {
  stations.push({
    ...stations[0],
    id: "other",
    name: "다른 방송",
    groupId: null as unknown as string,
  });
  dispose = await mountApp(root);
  await tick();
  click("다른 방송 재생");
  await tick();
  const count = mock.resolve.mock.calls.length,
    stops = mock.stop.mock.calls.length;
  click("TBN 지역 선택");
  click("TBN 5 지역 선택");
  await tick();
  expect(mock.resolve).toHaveBeenCalledTimes(count);
  expect(mock.stop).toHaveBeenCalledTimes(stops);
  expect(root.querySelector("footer")?.textContent).toContain("다른 방송");
  stations.pop();
});
