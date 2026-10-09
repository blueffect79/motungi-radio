import { it, expect, vi } from "vitest";
import { bindPlaybackLifecycle } from "./lifecycle";

it("native short wake and online reconnect; focus and time gaps do not", async () => {
  vi.useFakeTimers();
  const target = new EventTarget();
  const resume = vi.fn(async () => {});
  const remove = vi.fn();
  let wake = () => {};
  const cleanup = bindPlaybackLifecycle(
    { resume },
    target,
    async (callback) => {
      wake = callback;
      return remove;
    },
  );
  await Promise.resolve();
  target.dispatchEvent(new Event("visibilitychange"));
  target.dispatchEvent(new Event("focus"));
  vi.setSystemTime(Date.now() + 120_000);
  vi.advanceTimersByTime(15_000);
  expect(resume).not.toHaveBeenCalled();
  wake(); // Real OS notification does not depend on a 90-second timer gap.
  expect(resume).toHaveBeenCalledTimes(1);
  target.dispatchEvent(new Event("online"));
  expect(resume).toHaveBeenCalledTimes(2);
  cleanup();
  wake();
  target.dispatchEvent(new Event("online"));
  expect(resume).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it("unregisters a listener that completes registration after disposal", async () => {
  let registered!: (remove: () => void) => void;
  const remove = vi.fn();
  const resume = vi.fn(async () => {});
  let wake = () => {};
  const cleanup = bindPlaybackLifecycle(
    { resume },
    new EventTarget(),
    (callback) => {
      wake = callback;
      return new Promise((resolve) => {
        registered = resolve;
      });
    },
  );
  cleanup();
  registered(remove);
  await Promise.resolve();
  wake();
  expect(remove).toHaveBeenCalledOnce();
  expect(resume).not.toHaveBeenCalled();
});

it("routes wake through real playback intent, failure, retry and stop", async () => {
  const { PlayerController } = await import("./controller");
  const resolve = vi.fn(async (stationId: string) => ({
    ok: true as const,
    data: {
      stationId,
      url: "https://example.org/live",
      format: "mp3" as const,
      resolvedAt: "",
    },
  }));
  const player = new PlayerController({
    resolve,
    transport: { start: vi.fn(), stop: vi.fn(), setVolume: vi.fn() },
  });
  let wake = () => {};
  const cleanup = bindPlaybackLifecycle(
    player,
    new EventTarget(),
    async (callback) => {
      wake = callback;
      return () => {};
    },
  );
  player.restore("a");
  wake();
  expect(resolve).not.toHaveBeenCalled();
  await player.play();
  resolve.mockRejectedValueOnce(new Error("offline after wake"));
  wake();
  await vi.waitFor(() => expect(player.state.status).toBe("error"));
  expect(player.state.stationId).toBe("a");
  expect(resolve).toHaveBeenCalledTimes(2);
  await player.retry();
  expect(resolve).toHaveBeenCalledTimes(3);
  player.stop();
  wake();
  expect(resolve).toHaveBeenCalledTimes(3);
  expect(player.state.status).toBe("stopped");
  cleanup();
});
