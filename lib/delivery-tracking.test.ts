import { describe, expect, it } from "vitest";
import {
  DRIVER_POSITION_HEARTBEAT_MS,
  DRIVER_POSITION_MIN_INTERVAL_MS,
  gpsFreshness,
  shouldPublishDriverPosition,
} from "@/lib/delivery-tracking";

describe("tracking de repartidores", () => {
  const origin = { latitude: -33.3017, longitude: -66.3378, recordedAt: 1_000_000 };

  it("envía la primera lectura y limita lecturas demasiado frecuentes", () => {
    expect(shouldPublishDriverPosition(null, origin)).toBe(true);
    expect(
      shouldPublishDriverPosition(origin, {
        ...origin,
        latitude: origin.latitude + 0.01,
        recordedAt: origin.recordedAt + DRIVER_POSITION_MIN_INTERVAL_MS - 1,
      }),
    ).toBe(false);
  });

  it("envía por movimiento significativo y conserva un heartbeat", () => {
    expect(
      shouldPublishDriverPosition(origin, {
        ...origin,
        latitude: origin.latitude + 0.0002,
        recordedAt: origin.recordedAt + DRIVER_POSITION_MIN_INTERVAL_MS,
      }),
    ).toBe(true);
    expect(
      shouldPublishDriverPosition(origin, {
        ...origin,
        recordedAt: origin.recordedAt + DRIVER_POSITION_HEARTBEAT_MS,
      }),
    ).toBe(true);
  });

  it("clasifica frescura sin presentar posiciones antiguas como online", () => {
    const now = new Date("2026-08-22T12:00:00.000Z").getTime();
    expect(gpsFreshness(new Date(now - 5_000), now)).toEqual({ label: "En vivo", state: "live" });
    expect(gpsFreshness(new Date(now - 20_000), now)).toEqual({ label: "Hace 20 s", state: "recent" });
    expect(gpsFreshness(new Date(now - 120_000), now)).toEqual({ label: "Hace 2 min", state: "recent" });
    expect(gpsFreshness(new Date(now - 300_000), now)).toEqual({ label: "Ubicación desactualizada", state: "stale" });
  });
});
