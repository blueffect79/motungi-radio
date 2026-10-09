import type {
  AppError,
  Playback,
  ResolvedStream,
  Result,
  Settings,
} from "../../shared/contracts";
export interface TransportEvents {
  playing(): void;
  waiting(): void;
  error(error: AppError): void;
}
export interface Transport {
  start(stream: ResolvedStream, events: TransportEvents): void;
  stop(): void;
  setVolume(volume: number): void;
}
export interface PlayerDependencies {
  transport: Transport;
  resolve(
    stationId: string,
    signal: AbortSignal,
  ): Promise<Result<ResolvedStream>>;
  persist?(patch: Partial<Pick<Settings, "volume" | "lastStationId">>): void;
}
const failed = (): AppError => ({
  code: "network",
  message: "방송 연결에 실패했습니다. 다시 재생해 주세요.",
  retryable: true,
});
/** One controller per application. State never contains a token-bearing stream URL. */
export class PlayerController {
  private current: Playback = {
    status: "idle",
    stationId: null,
    requestId: 0,
    error: null,
  };
  private intent = false;
  private pending?: AbortController;
  private listeners = new Set<(state: Playback) => void>();
  constructor(private readonly dependencies: PlayerDependencies) {
    dependencies.transport.setVolume(100);
  }
  get state(): Playback {
    return { ...this.current };
  }
  subscribe(listener: (state: Playback) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private publish(patch: Partial<Playback>) {
    this.current = { ...this.current, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }
  private invalidate() {
    this.pending?.abort();
    this.pending = undefined;
    this.current = { ...this.current, requestId: this.current.requestId + 1 };
    this.dependencies.transport.stop();
  }
  restore(stationId: string | null, volume = 100) {
    this.intent = false;
    this.invalidate();
    this.setVolume(volume, false);
    this.publish({
      stationId,
      status: stationId ? "stopped" : "idle",
      error: null,
    });
  }
  setVolume(volume: number, persist = true) {
    const value = Number.isFinite(volume)
      ? Math.max(0, Math.min(100, volume))
      : 100;
    this.dependencies.transport.setVolume(value);
    if (persist) this.dependencies.persist?.({ volume: value });
  }
  async select(stationId: string) {
    this.dependencies.persist?.({ lastStationId: stationId });
    await this.connect(stationId);
  }
  async play() {
    if (this.current.stationId) await this.connect(this.current.stationId);
  }
  async retry() {
    await this.play();
  }
  stop() {
    this.intent = false;
    this.invalidate();
    this.publish({
      status: this.current.stationId ? "stopped" : "idle",
      error: null,
    });
  }
  /** Called by native resume/power event; visibility changes must NOT call stop. */
  async resume() {
    if (this.intent && this.current.stationId)
      await this.connect(this.current.stationId);
  }
  dispose() {
    this.stop();
    this.listeners.clear();
  }
  private async connect(stationId: string) {
    this.invalidate();
    this.intent = true;
    const requestId = this.current.requestId;
    const abort = new AbortController();
    this.pending = abort;
    this.publish({ stationId, status: "loading", error: null });
    const active = () =>
      !abort.signal.aborted &&
      this.intent &&
      this.current.requestId === requestId;
    const error = (e: AppError) => {
      if (!active()) return;
      abort.abort();
      this.dependencies.transport.stop();
      this.publish({ status: "error", error: e });
    };
    try {
      const result = await this.dependencies.resolve(stationId, abort.signal);
      if (!active()) return;
      if (!result.ok) {
        error(result.error);
        return;
      }
      if (result.data.stationId !== stationId) {
        error({
          code: "invalid_response",
          message: "방송 응답이 선택 채널과 일치하지 않습니다.",
          retryable: false,
        });
        return;
      }
      this.dependencies.transport.start(result.data, {
        playing: () => {
          if (active()) this.publish({ status: "playing", error: null });
        },
        waiting: () => {
          if (active()) this.publish({ status: "loading" });
        },
        error,
      });
    } catch {
      error(failed());
    }
  }
}
