import type { ProgramState } from "../../shared/contracts";
export function unavailable(stationId: string, now = Date.now()): ProgramState {
  return {
    stationId,
    status: "unavailable",
    sourceKind: null,
    title: null,
    startsAt: null,
    endsAt: null,
    fetchedAt: new Date(now).toISOString(),
    sourceUrl: null,
  };
}
export function currentProgram(
  value: ProgramState,
  now = Date.now(),
): ProgramState {
  const start = Date.parse(value.startsAt ?? ""),
    end = Date.parse(value.endsAt ?? "");
  return value.status === "available" &&
    !!value.title?.trim() &&
    (value.sourceKind === "live" || value.sourceKind === "schedule") &&
    !!value.sourceUrl &&
    start <= now &&
    now < end
    ? value
    : unavailable(value.stationId, now);
}
/** Metadata only: deliberately has no playback dependency. Timers continue while hidden;
 * callers must refresh on visibilitychange when reopening to recover OS timer suspension. */
export class ProgramPoller {
  private pending: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private failures = 0;
  private values: ProgramState[] = [];
  constructor(
    private ids: string[],
    private fetch: (ids: string[]) => Promise<ProgramState[]>,
    private publish: (values: ProgramState[]) => void,
    private now = Date.now,
  ) {}
  private normalize(values: ProgramState[]) {
    const now = this.now();
    const byId = new Map(values.map((value) => [value.stationId, value]));
    return this.ids.map((id) =>
      currentProgram(byId.get(id) ?? unavailable(id, now), now),
    );
  }
  refresh(): Promise<void> {
    if (this.pending) return this.pending;
    if (this.stopped) return Promise.resolve();
    clearTimeout(this.timer);
    this.values = this.normalize(this.values);
    this.publish(this.values);
    this.pending = (async () => {
      try {
        const values = await this.fetch(this.ids);
        this.values = this.normalize(values);
        this.failures = 0;
      } catch {
        this.values = this.ids.map((id) => unavailable(id, this.now()));
        this.failures++;
      }
      if (this.stopped) return;
      this.publish(this.values);
      const boundary = Math.min(
        ...this.values
          .filter((v) => v.status === "available")
          .map((v) => Date.parse(v.endsAt!) - this.now()),
      );
      const retry = this.failures
        ? Math.min(300000, 15000 * 2 ** Math.min(this.failures - 1, 5))
        : 300000;
      this.timer = setTimeout(
        () => {
          void this.refresh();
        },
        Math.max(10, Math.min(retry, boundary)),
      );
    })().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}
