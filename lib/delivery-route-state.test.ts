import { describe, expect, it } from "vitest";
import { getRouteStats } from "@/lib/delivery-route-state";

describe("getRouteStats", () => {
  const baseRoute = {
    totalStops: 3,
    startedAt: "2026-08-24T10:00:00.000Z",
    completedAt: "2026-08-24T12:00:00.000Z",
    totalDurationS: 7200,
  };

  it("calcula métricas básicas desde deliveries", () => {
    const deliveries = [
      { status: "DELIVERED", incidents: [] },
      { status: "DELIVERED", incidents: [] },
      { status: "FAILED", incidents: [] },
    ];
    const stats = getRouteStats(baseRoute, deliveries);
    expect(stats.totalStops).toBe(3);
    expect(stats.deliveredStops).toBe(2);
    expect(stats.incidentStops).toBe(0);
    expect(stats.failedStops).toBe(1);
    expect(stats.duration).toBe(7200);
    expect(stats.progress).toBe(67);
  });

  it("calcula incidencias desde deliveries con incidents", () => {
    const deliveries = [
      { status: "DELIVERED", incidents: [{ resolved: false }] },
      { status: "DELIVERED", incidents: [] },
      { status: "DELIVERED", incidents: [] },
    ];
    const stats = getRouteStats(baseRoute, deliveries);
    expect(stats.incidentStops).toBe(1);
    expect(stats.deliveredStops).toBe(3);
  });

  it("usa completedAt - startedAt cuando ambos existen", () => {
    const route = {
      totalStops: 2,
      startedAt: "2026-08-24T10:00:00.000Z",
      completedAt: "2026-08-24T11:30:00.000Z",
      totalDurationS: 5400,
    };
    const stats = getRouteStats(route, [{ status: "DELIVERED", incidents: [] }, { status: "DELIVERED", incidents: [] }]);
    expect(stats.duration).toBe(5400);
  });

  it("usa cancelledAt si completedAt falta", () => {
    const route = {
      totalStops: 2,
      startedAt: "2026-08-24T10:00:00.000Z",
      cancelledAt: "2026-08-24T10:15:00.000Z",
      totalDurationS: null,
    };
    const stats = getRouteStats(route, [{ status: "CANCELLED", incidents: [] }, { status: "PENDING", incidents: [] }]);
    expect(stats.duration).toBe(900);
  });

  it("fallback a totalDurationS cuando faltan timestamps", () => {
    const route = {
      totalStops: 2,
      totalDurationS: 3600,
    };
    const stats = getRouteStats(route, [{ status: "DELIVERED", incidents: [] }, { status: "DELIVERED", incidents: [] }]);
    expect(stats.duration).toBe(3600);
  });

  it("retorna null cuando no hay duración ni timestamps", () => {
    const route = { totalStops: 2 };
    const stats = getRouteStats(route, [{ status: "DELIVERED", incidents: [] }, { status: "DELIVERED", incidents: [] }]);
    expect(stats.duration).toBeNull();
  });

  it("usa deliveries.length como fallback de totalStops cuando route.totalStops es 0", () => {
    const route = { totalStops: 0 };
    const deliveries = [
      { status: "DELIVERED", incidents: [] },
      { status: "DELIVERED", incidents: [] },
      { status: "DELIVERED", incidents: [] },
    ];
    const stats = getRouteStats(route, deliveries);
    expect(stats.totalStops).toBe(3);
  });

  it("progreso 0 cuando no hay entregas", () => {
    const route = { totalStops: 3 };
    const stats = getRouteStats(route, []);
    expect(stats.progress).toBe(0);
    expect(stats.deliveredStops).toBe(0);
  });
});
