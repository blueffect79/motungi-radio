import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { PlayerController } from "./controller";

type WakeListener = (onWake: () => void) => Promise<UnlistenFn>;
const nativeWake: WakeListener = (onWake) => listen("system-resumed", onWake);

/** OS wake and network restoration reconnect only when the player still intends to play.
 * No scheduling-gap heuristic: background throttling and window focus are not system wake.
 */
export function bindPlaybackLifecycle(
  player: Pick<PlayerController, "resume">,
  target: EventTarget = window,
  subscribeWake: WakeListener = nativeWake,
): () => void {
  let disposed = false;
  let unlisten: UnlistenFn | undefined;
  const resume = () => {
    if (!disposed) void player.resume();
  };
  target.addEventListener("online", resume);
  void subscribeWake(resume)
    .then((remove) => {
      if (disposed) remove();
      else unlisten = remove;
    })
    .catch(() => {
      // Browser previews have no native bridge. Network restoration remains available.
    });
  return () => {
    disposed = true;
    target.removeEventListener("online", resume);
    unlisten?.();
    unlisten = undefined;
  };
}
