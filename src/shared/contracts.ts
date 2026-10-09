export type ErrorCode = 'network' | 'timeout' | 'unavailable' | 'invalid_response' | 'unsupported_format' | 'os_registration' | 'storage';
export interface AppError { code: ErrorCode; message: string; retryable: boolean }
export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };
export interface Station { id: string; providerId: string; name: string; region: string | null; groupId: 'tbn' | null; officialPageUrl: string; streamKey: string }
export interface Catalog { version: number; stations: Station[] }
export interface ResolvedStream { stationId: string; url: string; format: 'hls' | 'aac' | 'mp3'; resolvedAt: string }
export interface Playback { status: 'idle' | 'loading' | 'playing' | 'stopped' | 'error'; stationId: string | null; requestId: number; error: AppError | null }
export interface ProgramState { stationId: string; status: 'available' | 'unavailable'; sourceKind: 'live' | 'schedule' | null; title: string | null; startsAt: string | null; endsAt: string | null; fetchedAt: string; sourceUrl: string | null }
export interface Settings { schemaVersion: 1; favoriteIds: string[]; volume: number; lastStationId: string | null; tbnStationId: string | null }
