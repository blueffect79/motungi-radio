import { invoke } from "@tauri-apps/api/core";
import type { ResolvedStream, Result } from "../../shared/contracts";
// Timestamp seed keeps IDs increasing across ordinary webview reloads as well.
let nextRequestId = Date.now() * 1000;
/** cancel_resolve_stream cancels native resolver work. No URLs enter persistence or logs. */
export async function resolveStream(
  stationId: string,
  signal: AbortSignal,
): Promise<Result<ResolvedStream>> {
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  const requestId = ++nextRequestId;
  const cancel = () => {
    void invoke("cancel_resolve_stream", { requestId }).catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    return await invoke<Result<ResolvedStream>>("resolve_stream", {
      stationId,
      requestId,
    });
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
