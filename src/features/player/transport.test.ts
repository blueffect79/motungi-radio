import { afterEach, describe, it, expect, vi } from "vitest";
import { HtmlAudioTransport } from "./transport";
class FakeAudio extends EventTarget {
  preload = "";
  volume = 1;
  src = "";
  error: null | { code: number } = null;
  play = vi.fn(async () => {});
  pause = vi.fn();
  load = vi.fn();
  canPlayType = vi.fn(() => "maybe");
  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}
describe("single HTMLAudio transport", () => {
  it("reuses one audio, native HLS path, muted playing event, clears old source", () => {
    const audio = new FakeAudio();
    const transport = new HtmlAudioTransport(
      audio as unknown as HTMLAudioElement,
    );
    const first = { playing: vi.fn(), waiting: vi.fn(), error: vi.fn() };
    const second = { playing: vi.fn(), waiting: vi.fn(), error: vi.fn() };
    const stream = {
      stationId: "a",
      url: "https://example.org/live.m3u8",
      format: "hls" as const,
      resolvedAt: "",
    };
    transport.start(stream, first);
    expect(first.playing).not.toHaveBeenCalled();
    transport.setVolume(0);
    audio.dispatchEvent(new Event("playing"));
    expect(first.playing).toHaveBeenCalledTimes(1);
    transport.start({ ...stream, stationId: "b" }, second);
    audio.dispatchEvent(new Event("playing"));
    expect(first.playing).toHaveBeenCalledTimes(1);
    expect(second.playing).toHaveBeenCalledTimes(1);
    expect(audio.volume).toBe(0);
    transport.stop();
    expect(audio.src).toBe("");
    audio.dispatchEvent(new Event("playing"));
    expect(second.playing).toHaveBeenCalledTimes(1);
  });
  it("play rejection becomes explicit error", async () => {
    const audio = new FakeAudio();
    audio.play.mockRejectedValueOnce(new Error("private url omitted"));
    const transport = new HtmlAudioTransport(
      audio as unknown as HTMLAudioElement,
    );
    const events = { playing: vi.fn(), waiting: vi.fn(), error: vi.fn() };
    transport.start(
      {
        stationId: "a",
        url: "https://example.org/live",
        format: "mp3",
        resolvedAt: "",
      },
      events,
    );
    await Promise.resolve();
    expect(events.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: "network" }),
    );
    expect(events.playing).not.toHaveBeenCalled();
  });
});

describe("bounded startup and rebuffer watchdog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  const stream = {
    stationId: "a",
    url: "https://example.org/live",
    format: "mp3" as const,
    resolvedAt: "",
  };
  const setup = () => {
    const audio = new FakeAudio();
    const transport = new HtmlAudioTransport(
      audio as unknown as HTMLAudioElement,
    );
    const events = { playing: vi.fn(), waiting: vi.fn(), error: vi.fn() };
    return { audio, transport, events };
  };
  it("fails silent startup after 20 seconds and reports a retryable timeout only once", () => {
    vi.useFakeTimers();
    const { audio, transport, events } = setup();
    transport.start(stream, events);
    vi.advanceTimersByTime(19_999);
    expect(events.error).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(events.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: "timeout", retryable: true }),
    );
    expect(audio.src).toBe("");
    expect(audio.pause).toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(events.error).toHaveBeenCalledTimes(1);
    transport.stop();
    vi.useRealTimers();
  });
  it("playing clears startup deadline; repeated waiting cannot extend a stalled rebuffer forever", () => {
    vi.useFakeTimers();
    const { audio, transport, events } = setup();
    transport.start(stream, events);
    audio.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(30_000);
    expect(events.error).not.toHaveBeenCalled();
    audio.dispatchEvent(new Event("waiting"));
    vi.advanceTimersByTime(15_000);
    audio.dispatchEvent(new Event("waiting"));
    vi.advanceTimersByTime(5_000);
    expect(events.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: "timeout" }),
    );
    transport.stop();
    vi.useRealTimers();
  });
  it("recovered playing and stop each cancel pending watchdogs", () => {
    vi.useFakeTimers();
    const { audio, transport, events } = setup();
    transport.start(stream, events);
    audio.dispatchEvent(new Event("playing"));
    audio.dispatchEvent(new Event("waiting"));
    vi.advanceTimersByTime(10_000);
    audio.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(30_000);
    expect(events.error).not.toHaveBeenCalled();
    audio.dispatchEvent(new Event("waiting"));
    transport.stop();
    vi.advanceTimersByTime(30_000);
    expect(events.error).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
  it("old timeout cannot fail a replacement channel", () => {
    vi.useFakeTimers();
    const timer = vi.spyOn(globalThis, "setTimeout");
    const { audio, transport, events } = setup();
    const next = { playing: vi.fn(), waiting: vi.fn(), error: vi.fn() };
    transport.start(stream, events);
    const oldTimeout = timer.mock.calls[0][0] as () => void;
    vi.advanceTimersByTime(15_000);
    transport.start({ ...stream, stationId: "b" }, next);
    oldTimeout();
    vi.advanceTimersByTime(5_000);
    expect(events.error).not.toHaveBeenCalled();
    expect(next.error).not.toHaveBeenCalled();
    audio.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(30_000);
    expect(next.error).not.toHaveBeenCalled();
    transport.stop();
    vi.useRealTimers();
  });
});

describe("deferred HLS loading", () => {
  const stream = {
    stationId: "a",
    url: "https://example.org/live.m3u8",
    format: "hls" as const,
    resolvedAt: "",
  };
  const events = () => ({ playing: vi.fn(), waiting: vi.fn(), error: vi.fn() });
  function fixture() {
    const instances: FakeHls[] = [];
    class FakeHls {
      static isSupported = () => true;
      static Events = { ERROR: "error", MANIFEST_PARSED: "manifest" };
      handlers = new Map<string, (...args: any[]) => void>();
      destroy = vi.fn();
      loadSource = vi.fn();
      attachMedia = vi.fn();
      constructor() {
        instances.push(this);
      }
      on(name: string, handler: (...args: any[]) => void) {
        this.handlers.set(name, handler);
      }
    }
    let resolve!: (value: typeof import("hls.js").default) => void;
    let reject!: (error: Error) => void;
    const load = vi.fn(
      () =>
        new Promise<typeof import("hls.js").default>((yes, no) => {
          resolve = yes;
          reject = no;
        }),
    );
    const audio = new FakeAudio();
    audio.canPlayType.mockReturnValue("");
    const transport = new HtmlAudioTransport(
      audio as unknown as HTMLAudioElement,
      load,
    );
    return {
      audio,
      transport,
      load,
      instances,
      resolve: () =>
        resolve(FakeHls as unknown as typeof import("hls.js").default),
      reject: () => reject(new Error("load failed")),
    };
  }
  it("loads HLS only when native playback is unavailable and waits for the manifest", async () => {
    const f = fixture(),
      e = events();
    f.audio.canPlayType.mockReturnValue("maybe");
    f.transport.start(stream, e);
    expect(f.load).not.toHaveBeenCalled();
    f.audio.canPlayType.mockReturnValue("");
    f.transport.start(stream, e);
    expect(f.load).toHaveBeenCalledOnce();
    expect(f.instances).toHaveLength(0);
    f.resolve();
    await Promise.resolve();
    expect(f.instances[0].loadSource).toHaveBeenCalledWith(stream.url);
    expect(f.instances[0].attachMedia).toHaveBeenCalledWith(f.audio);
    expect(f.audio.play).toHaveBeenCalledTimes(1);
    f.instances[0].handlers.get("manifest")?.();
    expect(f.audio.play).toHaveBeenCalledTimes(2);
    f.transport.stop();
    expect(f.instances[0].destroy).toHaveBeenCalledOnce();
  });
  it("a delayed import cannot replace a newer channel", async () => {
    const f = fixture(),
      old = events(),
      next = events();
    f.transport.start(stream, old);
    f.transport.start(
      {
        ...stream,
        stationId: "b",
        format: "mp3",
        url: "https://example.org/next",
      },
      next,
    );
    f.resolve();
    await Promise.resolve();
    expect(f.instances).toHaveLength(0);
    expect(f.audio.src).toBe("https://example.org/next");
    expect(old.error).not.toHaveBeenCalled();
    f.transport.stop();
  });
  it("reports an active load failure but ignores failure after stop", async () => {
    const f = fixture(),
      first = events(),
      stopped = events();
    f.transport.start(stream, first);
    f.reject();
    await Promise.resolve();
    await Promise.resolve();
    expect(first.error).toHaveBeenCalledOnce();
    f.transport.start(stream, stopped);
    f.transport.stop();
    f.reject();
    await Promise.resolve();
    await Promise.resolve();
    expect(stopped.error).not.toHaveBeenCalled();
  });
});
