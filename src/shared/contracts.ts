export type ErrorCode =
  | "network"
  | "timeout"
  | "unavailable"
  | "invalid_response"
  | "unsupported_format"
  | "os_registration"
  | "storage";
export interface AppError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
/** streamKey is an opaque resolver key; "unavailable" marks an unverified official connection. Never persist resolved URLs. */
export interface Station {
  id: string;
  providerId: string;
  name: string;
  region: string | null;
  groupId: "tbn" | null;
  officialPageUrl: string;
  streamKey: string;
}
export interface Catalog {
  version: number;
  stations: Station[];
}
export interface ResolvedStream {
  stationId: string;
  url: string;
  format: "hls" | "aac" | "mp3";
  resolvedAt: string;
}
export interface Playback {
  status: "idle" | "loading" | "playing" | "stopped" | "error";
  stationId: string | null;
  requestId: number;
  error: AppError | null;
}
export interface ScheduleEntry {
  title: string;
  startsAt: string;
  endsAt: string;
  imageUrl?: string | null;
}
export interface Schedule {
  stationId: string;
  entries: ScheduleEntry[];
  fetchedAt: string;
}
export interface ProgramState {
  imageUrl?: string | null;
  stationId: string;
  status: "available" | "unavailable";
  sourceKind: "live" | "schedule" | null;
  title: string | null;
  startsAt: string | null;
  endsAt: string | null;
  fetchedAt: string;
  sourceUrl: string | null;
}
export interface Settings {
  schemaVersion: 1;
  analyticsEnabled?: boolean;
  onboardingCompleted?: boolean;
  appearance?: "system" | "light" | "dark";
  playerMode?: "full" | "mini";
  favoriteIds: string[];
  volume: number;
  lastStationId: string | null;
  tbnStationId: string | null;
}
