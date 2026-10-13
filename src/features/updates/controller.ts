import { isAppStore } from "../../shared/distribution";
import { invoke } from "@tauri-apps/api/core";
export class UpdateController {
  message = "새 버전을 자동으로 확인합니다.";
  ready = false;
  busy = false;
  private disposed = false;
  private timer?: ReturnType<typeof setInterval>;
  private initial?: ReturnType<typeof setTimeout>;
  constructor(private changed: () => void, private call: typeof invoke = invoke) {}
  start() {
    this.initial = setTimeout(() => void this.check(), 15000);
    this.timer = setInterval(() => void this.check(), 6 * 60 * 60 * 1000);
  }
  async check() {
    if (isAppStore || this.busy || this.ready || this.disposed) return;
    this.busy = true;
    this.message = "업데이트 확인 및 다운로드 중…";
    this.changed();
    try {
      const result = await this.call<{version: string | null; supported: boolean}>("prepare_update");
      this.ready = !!result.version;
      this.message = !result.supported ? "이 설치 형식은 홈페이지에서 업데이트해 주세요." : result.version ? `${result.version} 업데이트가 준비되었습니다.` : "최신 버전입니다.";
    } catch { this.message = "업데이트를 확인하지 못했습니다. 다시 시도해 주세요."; }
    this.busy = false;
    if (!this.disposed) this.changed();
  }
  async install() {
    if (isAppStore || !this.ready || this.busy || this.disposed) return;
    this.busy = true;
    this.message = "업데이트 설치 중…";
    this.changed();
    try { await this.call("install_update"); }
    catch { this.message = "설치하지 못했습니다. 다시 시도하거나 홈페이지에서 설치해 주세요."; }
    this.busy = false;
    if (!this.disposed) this.changed();
  }
  dispose() { this.disposed = true; clearTimeout(this.initial); clearInterval(this.timer); }
}
