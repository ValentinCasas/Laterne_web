import { describe, expect, it } from "vitest";
import {
  haversineMeters,
  isLocationWithinGeofence,
  DEFAULT_GEOFENCE_RADIUS_METERS,
} from "@/lib/geofence";

describe("haversineMeters", () => {
  it("calcula ~0 para el mismo punto", () => {
    expect(haversineMeters(-33.3017, -66.3378, -33.3017, -66.3378)).toBeLessThan(0.1);
  });

  it("distingue puntos cercanos (~100 m)", () => {
    const distance = haversineMeters(-33.3017, -66.3378, -33.3026, -66.3378);
    expect(distance).toBeGreaterThan(50);
    expect(distance).toBeLessThan(150);
  });

  it("devuelve infinito ante coordenadas no finitas", () => {
    expect(haversineMeters(Number.NaN, 0, 0, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("isLocationWithinGeofence", () => {
  const config = {
    enabled: true,
    latitude: -33.3017,
    longitude: -66.3378,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  };

  it("acepta cualquier ubicación cuando está deshabilitado", () => {
    expect(isLocationWithinGeofence({ ...config, enabled: false }, null)).toEqual({
      ok: true,
      reason: "disabled",
    });
  });

  it("rechaza cuando no hay ubicación", () => {
    expect(isLocationWithinGeofence(config, null)).toEqual({ ok: false, reason: "missing" });
    expect(isLocationWithinGeofence(config, undefined)).toEqual({ ok: false, reason: "missing" });
  });

  it("acepta dentro del radio", () => {
    expect(isLocationWithinGeofence(config, { latitude: -33.3017, longitude: -66.3378 })).toEqual({
      ok: true,
      reason: "ok",
    });
  });

  it("rechaza fuera del radio", () => {
    expect(isLocationWithinGeofence(config, { latitude: -33.3, longitude: -66.3 })).toEqual({
      ok: false,
      reason: "outside",
    });
  });

  it("suma la precisión reportada como tolerancia", () => {
    const insideByAccuracy = isLocationWithinGeofence(
      config,
      { latitude: -33.3026, longitude: -66.3378, accuracy: 150 },
    );
    expect(insideByAccuracy.ok).toBe(true);
  });

  it("ignora coordenadas inválidas del cliente", () => {
    expect(
      isLocationWithinGeofence(config, { latitude: Number.NaN, longitude: -66.3378 }),
    ).toEqual({ ok: false, reason: "missing" });
  });
});