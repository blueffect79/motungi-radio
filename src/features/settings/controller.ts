import { invoke } from "@tauri-apps/api/core";
import type {
  Settings,
  Station,
  Result,
  AppError,
} from "../../shared/contracts";
export const defaults = (): Settings => ({
  schemaVersion: 1,
  appearance: "system",
  playerMode: "full",
  favoriteIds: [],
  volume: 100,
  lastStationId: null,
  tbnStationId: null,
});
export interface SettingsPort {
  load(): Promise<Result<Settings>>;
  save(settings: Settings): Promise<Result<Settings>>;
}
export const settingsPort: SettingsPort = {
  load: () => invoke("load_settings"),
  save: (settings) => invoke("save_settings", { settings }),
};
/** Instantiate once per application. Mutations read the latest committed value inside the queue. */
export class SettingsController {
  settings = defaults();
  error: AppError | null = null;
  private tail: Promise<void> = Promise.resolve();
  constructor(
    private port: SettingsPort = settingsPort,
    private changed: () => void = () => {},
  ) {}
  private enqueue(work: () => Promise<void>): Promise<void> {
    const next = this.tail.then(async () => {
      try {
        await work();
      } catch {
        this.error = {
          code: "storage",
          message: "설정을 저장하거나 불러올 수 없습니다.",
          retryable: true,
        };
      }
      this.changed();
    });
    this.tail = next.catch(() => {});
    return next;
  }
  load() {
    return this.enqueue(async () => {
      const r = await this.port.load();
      if (r.ok) {
        this.settings = r.data;
        this.error = null;
      } else this.error = r.error;
    });
  }
  update(change: (current: Settings) => Settings) {
    return this.enqueue(async () => {
      const next = change(structuredClone(this.settings));
      const r = await this.port.save(next);
      if (r.ok) {
        this.settings = r.data;
        this.error = null;
      } else this.error = r.error;
    });
  }
}
/** Removed favorites and last station remain visible/removable; never choose a replacement. */
export function rememberedStations(settings: Settings, stations: Station[]) {
  return [
    ...new Set([
      ...settings.favoriteIds,
      ...(settings.lastStationId ? [settings.lastStationId] : []),
    ]),
  ].map((id) => ({
    id,
    name: stations.find((s) => s.id === id)?.name ?? id,
    available: stations.some((s) => s.id === id),
  }));
}
export interface AutostartPort {
  get(): Promise<Result<{ enabled: boolean }>>;
  set(enabled: boolean): Promise<Result<{ enabled: boolean }>>;
}
export const autostartPort: AutostartPort = {
  get: () => invoke("get_autostart"),
  set: (enabled) => invoke("set_autostart", { enabled }),
};
export class AutostartController {
  enabled = false;
  error: AppError | null = null;
  private tail: Promise<void> = Promise.resolve();
  constructor(
    private port: AutostartPort = autostartPort,
    private changed: () => void = () => {},
  ) {}
  private run(action: () => Promise<Result<{ enabled: boolean }>>) {
    const next = this.tail.then(async () => {
      try {
        const r = await action();
        if (r.ok) {
          this.enabled = r.data.enabled;
          this.error = null;
        } else this.error = r.error;
      } catch {
        this.error = {
          code: "os_registration",
          message: "로그인 시 실행 설정을 확인할 수 없습니다.",
          retryable: true,
        };
      }
      this.changed();
    });
    this.tail = next.catch(() => {});
    return next;
  }
  refresh() {
    return this.run(() => this.port.get());
  }
  set(enabled: boolean) {
    return this.run(() => this.port.set(enabled));
  }
}
