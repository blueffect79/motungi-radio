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
it("keeps current program and Korean airtime visible in permanent footer through metadata refresh", async () => {
  const original = mock.invoke.getMockImplementation()!;
  let title = "아침 라디오";
  mock.invoke.mockImplementation(async (command, args) =>
    command === "get_programs"
      ? {
          ok: true,
          data: stations.map((s) => ({
            stationId: s.id,
            status: "available",
            sourceKind: "schedule",
            title: `${title} ${s.id}`,
            startsAt: new Date(Date.now() - 3600000).toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
            fetchedAt: new Date().toISOString(),
            sourceUrl: "https://example.com/program",
          })),
        }
      : original(command, args),
  );
  dispose = await mountApp(root);
  await tick();
  const footer = root.querySelector("footer")!;
  expect(footer.textContent).toContain("아침 라디오 tbn-0");
  expect(footer.textContent).toMatch(/\d{2}:\d{2}–\d{2}:\d{2} \(한국 시간\)/);
  expect(footer.textContent).toContain("편성표 기준");
  expect(root.querySelector("main")?.textContent).not.toContain("한국 시간");
  const volume = footer.querySelector<HTMLInputElement>("input")!;
  volume.focus();
  title = "새 프로그램";
  window.dispatchEvent(new Event("focus"));
  await tick();
  expect(footer.textContent).toContain("새 프로그램 tbn-0");
  expect(document.activeElement).toBe(volume);
  expect(footer.querySelector("input")).toBe(volume);
  click("TBN 지역 선택");
  click("TBN 5 지역 선택");
  await tick();
  expect(footer.textContent).toContain("새 프로그램 tbn-0");
  expect(root.querySelector(".station .program")?.textContent).toBe(
    "새 프로그램 tbn-5",
  );
});
it("preserves focus in the all-stations row when the same channel is also a favorite", async () => {
  stations.push({
    ...stations[0],
    id: "other",
    name: "다른 방송",
    groupId: null as unknown as string,
  });
  saved.favoriteIds = ["other"];
  try {
    dispose = await mountApp(root);
    await tick();
    for (const label of ["다른 방송 재생", "다른 방송 즐겨찾기 해제"]) {
      const matches = () =>
        Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter(
          (b) => b.getAttribute("aria-label") === label,
        );
      expect(matches()).toHaveLength(2);
      matches()[1].focus();
      window.dispatchEvent(new Event("focus"));
      await tick();
      expect(document.activeElement).toBe(matches()[1]);
    }
  } finally {
    stations.pop();
  }
});
it.each(["later favorite", "later play", "later stop"] as const)(
  "does not let a pending region save override %s",
  async (scenario) => {
    saved.favoriteIds = ["tbn-2"];
    dispose = await mountApp(root);
    await tick();
    if (scenario !== "later play") {
      click("방송 재생");
      await tick();
    }
    const original = mock.invoke.getMockImplementation()!;
    let release: (() => void) | undefined;
    let blocked = false;
    mock.invoke.mockImplementation((command, args) => {
      if (command === "save_settings" && !blocked) {
        blocked = true;
        return new Promise((resolve) => {
          release = () => {
            resolve(original(command, args));
          };
        });
      }
      return original(command, args);
    });
    click("TBN 지역 선택");
    click("TBN 5 지역 선택");
    await tick();
    expect(release).toBeDefined();
    if (scenario === "later favorite") click("TBN 2 재생");
    if (scenario === "later play") click("방송 재생");
    if (scenario === "later stop") click("방송 정지");
    await tick();
    const requests = mock.resolve.mock.calls.length;
    release!();
    await tick();
    expect(mock.resolve).toHaveBeenCalledTimes(requests);
    if (scenario === "later favorite") {
      expect(root.querySelector("footer")?.textContent).toContain("TBN 2");
      expect(root.querySelector("footer")?.textContent).toContain("재생 중");
    } else if (scenario === "later play") {
      expect(root.querySelector("footer")?.textContent).toContain("TBN 0");
      expect(root.querySelector("footer")?.textContent).toContain("재생 중");
    } else {
      expect(root.querySelector("footer")?.textContent).toContain("정지됨");
    }
  },
);
it("refreshes actual OS autostart state when an open settings panel regains focus", async () => {
  const original = mock.invoke.getMockImplementation()!;
  let enabled = true;
  mock.invoke.mockImplementation((command, args) =>
    command === "get_autostart"
      ? Promise.resolve({ ok: true, data: { enabled } })
      : original(command, args),
  );
  dispose = await mountApp(root);
  await tick();
  click("설정");
  await tick();
  expect(
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked,
  ).toBe(true);
  enabled = false;
  window.dispatchEvent(new Event("focus"));
  await tick();
  expect(
    root.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked,
  ).toBe(false);
  expect(root.textContent).toContain("OS 등록 상태: 꺼짐");
});
