import type { Playback, Settings, Station } from "../../shared/contracts";
export type ChannelRow = {
  id: string;
  name: string;
  available: boolean;
  station?: Station;
};
export function channelRows(stations: Station[], settings: Settings) {
  const row = (id: string): ChannelRow => {
    const station = stations.find((s) => s.id === id);
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
    all,
    favorites: [...new Set(settings.favoriteIds)].map(row),
    regions,
    removed:
      settings.lastStationId &&
      !stations.some((s) => s.id === settings.lastStationId) &&
      !settings.favoriteIds.includes(settings.lastStationId)
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
