// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { flowingTitle } from "./marquee";
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function fixture() {
  let resize = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const element = document.createElement("strong");
  document.body.append(element);
  let available = 160,
    length = 100;
  Object.defineProperty(element, "clientWidth", { get: () => available });
  const flow = flowingTitle(element);
  Object.defineProperty(element.querySelector(".title-text"), "scrollWidth", {
    get: () => length,
  });
  return {
    element,
    flow,
    disconnect,
    resize: () => resize(),
    size: (width: number, textWidth: number) => {
      available = width;
      length = textWidth;
      resize();
    },
  };
}
it("animates only overflow and falls back when resized to fit or hidden", async () => {
  const f = fixture();
  f.flow.update("프로그램");
  await Promise.resolve();
  expect(f.element.classList.contains("flowing")).toBe(false);
  f.size(160, 400);
  expect(f.element.classList.contains("flowing")).toBe(true);
  expect(f.element.querySelector<HTMLElement>(".title-copy")?.hidden).toBe(
    false,
  );
  f.size(500, 400);
  expect(f.element.classList.contains("flowing")).toBe(false);
  f.size(0, 400);
  expect(f.element.classList.contains("flowing")).toBe(false);
  f.flow.dispose();
});
it("keeps untrusted text literal and exposes one full accessible title", async () => {
  const f = fixture();
  f.size(160, 400);
  const value = "긴 제목 <img src=x onerror=alert(1)> & 방송";
  f.flow.update(value);
  await Promise.resolve();
  expect(f.element.querySelector("img")).toBeNull();
  expect(f.element.getAttribute("aria-label")).toBe(value);
  expect(f.element.title).toBe(value);
  expect(
    f.element.querySelector(".title-copy")?.getAttribute("aria-hidden"),
  ).toBe("true");
  const primary = f.element.querySelector(".title-text")?.firstChild;
  f.flow.update(value);
  expect(f.element.querySelector(".title-text")?.firstChild).toBe(primary);
  expect(f.element.classList.contains("flowing")).toBe(true);
  f.flow.dispose();
});
it("disconnects resize observation and ignores queued work after disposal", async () => {
  const f = fixture();
  f.flow.update("제목");
  f.flow.dispose();
  await Promise.resolve();
  expect(f.disconnect).toHaveBeenCalledOnce();
  f.size(160, 400);
  expect(f.element.classList.contains("flowing")).toBe(false);
  f.flow.update("뒤늦은 제목");
  expect(f.element.title).toBe("제목");
});
