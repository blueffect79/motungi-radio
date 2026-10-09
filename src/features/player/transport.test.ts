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
