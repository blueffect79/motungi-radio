import { describe, it, expect, vi } from "vitest";
import { UpdateController } from "./controller";
import type { invoke } from "@tauri-apps/api/core";
describe("updates", () => {
  it("automatically prepares but never installs without an explicit action", async () => {
    vi.useFakeTimers();
    const call = vi.fn().mockResolvedValue({version:"0.3.0", supported:true});
    const c = new UpdateController(() => {}, call as typeof invoke);
    c.start(); await vi.advanceTimersByTimeAsync(15000);
    expect(c.ready).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith("prepare_update");
    await c.install(); expect(call).toHaveBeenLastCalledWith("install_update");
    c.dispose(); vi.useRealTimers();
  });
  it("retries failures and ignores overlapping checks", async () => {
    let reject!: (e: Error) => void;
    const call = vi.fn().mockImplementationOnce(() => new Promise((_, r) => {reject=r;})).mockResolvedValue({version:null,supported:true});
    const c = new UpdateController(() => {}, call as typeof invoke);
    const first=c.check(); await c.check(); expect(call).toHaveBeenCalledTimes(1);
    reject(new Error("offline")); await first; expect(c.ready).toBe(false);
    await c.check(); expect(c.message).toBe("최신 버전입니다."); c.dispose();
  });
});
