import type { PlayerController } from "./controller";
/** Best-effort cross-platform wake detection. Native power-resume should call player.resume directly when available.
 * A long scheduling gap can also occur under OS throttling; never attach reconnect to focus/visibility.
 * A failed wake attempt remains error until another genuine online/wake event or manual retry.
 */
export function bindPlaybackLifecycle(
  player: Pick<PlayerController, "resume">,
  target: EventTarget = window,
): () => void {
  let last = Date.now();
  const online = () => {
    last = Date.now();
    void player.resume();
  };
  target.addEventListener("online", online);
  const timer = setInterval(() => {
    const now = Date.now();
    const gap = now - last;
    last = now;
    if (gap > 90_000) void player.resume();
  }, 15_000);
  return () => {
    clearInterval(timer);
    target.removeEventListener("online", online);
  };
}
