import { describe, it, expect, vi } from "vitest";
import {
  channelRows,
  changeRegion,
  channelNeighbors,
  moveChannel,
} from "./model";
import { PlayerController } from "../player/controller";
import { defaults } from "../settings/controller";
import type { Station, Playback } from "../../shared/contracts";
const stations: Station[] = Array.from({ length: 13 }, (_, i) => ({
  id: `tbn-${i}`,
  name: `TBN ${i}`,
  region: `지역 ${i}`,
  groupId: "tbn",
  providerId: "tbn",
  streamKey: "x",
  officialPageUrl: "https://example.com",
}));
const playback = (
  status: Playback["status"],
  stationId: string | null,
): Playback => ({ status, stationId, requestId: 0, error: null });
describe("channel presentation and intent", () => {
  it("collapses all 13 regions into one row", () => {
    const rows = channelRows(stations, {
      ...defaults(),
      tbnStationId: "tbn-2",
    });
    expect(rows.all).toHaveLength(1);
    expect(rows.all[0].id).toBe("tbn-2");
  });
  it("retains removed IDs without substituting a channel", () => {
    const rows = channelRows(stations, {
      ...defaults(),
      channelOrder: ["gone"],
      lastStationId: "old",
    });
    expect(rows.removed).toEqual(["old"]);
  });
  it.each(["playing", "loading"] as const)(
    "switches audio only while TBN is %s",
    (status) => {
      expect(changeRegion(stations, playback(status, "tbn-1"), "tbn-2")).toBe(
        true,
      );
    },
  );
  it.each(["idle", "stopped", "error"] as const)(
    "does not start stopped TBN (%s)",
    (status) => {
      expect(changeRegion(stations, playback(status, "tbn-1"), "tbn-2")).toBe(
        false,
      );
    },
  );
  it("does not disturb another broadcaster or restart same region", () => {
    expect(changeRegion(stations, playback("playing", "kbs"), "tbn-2")).toBe(
      false,
    );
    expect(changeRegion(stations, playback("playing", "tbn-2"), "tbn-2")).toBe(
      false,
    );
  });
  it("restores last channel silently, and first launch has none", () => {
    const resolve = vi.fn();
    const transport = { start: vi.fn(), stop: vi.fn(), setVolume: vi.fn() };
    const p = new PlayerController({ resolve, transport });
    p.restore("tbn-2", 30);
    expect(p.state).toMatchObject({ stationId: "tbn-2", status: "stopped" });
    expect(resolve).not.toHaveBeenCalled();
    expect(transport.start).not.toHaveBeenCalled();
    p.restore(null);
    expect(p.state.stationId).toBeNull();
  });
});

it("orders saved channels once and appends newly available ones", () => {
  const catalog = stations.slice(0, 3).map((s) => ({ ...s, groupId: null }));
  const settings = { ...defaults(), channelOrder: ["gone", "tbn-2", "tbn-2"] };
  expect(channelRows(catalog, settings).all.map((r) => r.id)).toEqual([
    "tbn-2",
    "tbn-0",
    "tbn-1",
  ]);
  expect(moveChannel(catalog, settings, "tbn-2", "tbn-1")).toEqual([
    "tbn-0",
    "tbn-1",
    "tbn-2",
    "gone",
  ]);
});
it("skips disabled neighbors from a directly selected disabled channel and wraps", () => {
  const catalog = stations.slice(0, 4).map((s) => ({ ...s, groupId: null }));
  const settings = {
    ...defaults(),
    channelOrder: ["tbn-2", "tbn-0", "tbn-3", "tbn-1"],
    disabledChannelIds: ["tbn-0", "tbn-3"],
  };
  expect(channelNeighbors(catalog, settings, "tbn-0").next?.id).toBe("tbn-1");
  expect(channelNeighbors(catalog, settings, "tbn-0").previous?.id).toBe(
    "tbn-2",
  );
  expect(channelNeighbors(catalog, settings, "tbn-1").next?.id).toBe("tbn-2");
  settings.disabledChannelIds = catalog.map((s) => s.id);
  expect(channelNeighbors(catalog, settings, "tbn-0")).toEqual({
    previous: undefined,
    next: undefined,
  });
});
