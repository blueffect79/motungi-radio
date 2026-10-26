import type { Playback, Settings, Station } from "../../shared/contracts";
export type ChannelRow = {
  id: string;
  name: string;
  available: boolean;
  station?: Station;
};
export function channelRows(stations: Station[], settings: Settings) {
  const byId = new Map(stations.map((station) => [station.id, station]));
  const row = (id: string): ChannelRow => {
    const station = byId.get(id);
    return { id, name: station?.name ?? id, available: !!station, station };
  };
  const regions = stations.filter((s) => s.groupId === "tbn");
  const selected =
    regions.find((s) => s.id === settings.tbnStationId) ?? regions[0];
  let grouped = false;
  const all = stations.flatMap((s) => {
    if (s.groupId !== "tbn") return [row(s.id)];
    if (grouped) return [];
    grouped = true;
    return selected ? [row(selected.id)] : [];
  });
  return {
    all: [
      ...new Set([...settings.channelOrder, ...all.map((r) => r.id)]),
    ].flatMap((id) => all.find((r) => r.id === id) ?? []),
    regions,
    removed:
      settings.lastStationId && !byId.has(settings.lastStationId)
        ? [settings.lastStationId]
        : [],
  };
}
export function changeRegion(
  stations: Station[],
  playback: Playback,
  id: string,
) {
  return (
    (playback.status === "playing" || playback.status === "loading") &&
    playback.stationId !== id &&
    stations.some((s) => s.id === playback.stationId && s.groupId === "tbn") &&
    stations.some((s) => s.id === id && s.groupId === "tbn")
  );
}

/** Scan from the current position, including when it was selected directly while disabled. */
export function channelNeighbors(
  stations: Station[],
  settings: Settings,
  current: string | null,
) {
  const ordered = channelRows(stations, settings).all;
  const index = ordered.findIndex((r) => r.id === current);
  const find = (direction: number) => {
    if (index < 0) return undefined;
    for (let step = 1; step < ordered.length; step++) {
      const row =
        ordered[(index + direction * step + ordered.length) % ordered.length];
      if (
        !settings.disabledChannelIds.includes(row.id) &&
        row.station?.streamKey !== "unavailable"
      )
        return row.station;
    }
    return undefined;
  };
  return { previous: find(-1), next: find(1) };
}
export function moveChannel(
  stations: Station[],
  settings: Settings,
  from: string,
  to: string,
) {
  const ids = channelRows(stations, settings).all.map((r) => r.id);
  const start = ids.indexOf(from),
    end = ids.indexOf(to);
  if (start < 0 || end < 0 || start === end) return settings.channelOrder;
  ids.splice(start, 1);
  ids.splice(end, 0, from);
  return [...ids, ...settings.channelOrder.filter((id) => !ids.includes(id))];
}
