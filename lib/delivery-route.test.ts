import { describe, expect, it } from "vitest";
import { googleMapsRouteUrl, orderDeliveryRouteStops } from "@/lib/delivery-route";

describe("recorrido de delivery", () => {
  const origin = { latitude: -33.3017, longitude: -66.3378 };

  it("ordena primero el destino más cercano y conserva todos los puntos", () => {
    const ordered = orderDeliveryRouteStops(origin, [
      { id: 30, latitude: -33.25, longitude: -66.3 },
      { id: 10, latitude: -33.302, longitude: -66.338 },
      { id: 20, latitude: -33.31, longitude: -66.34 },
    ]);
    expect(ordered.map((stop) => stop.id)).toEqual([10, 20, 30]);
  });

  it("genera un enlace de navegación con destino y paradas intermedias", () => {
    const url = googleMapsRouteUrl(origin, [
      { id: 1, latitude: -33.31, longitude: -66.34 },
      { id: 2, latitude: -33.32, longitude: -66.35 },
    ]);
    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("waypoints=");
    expect(url).toContain("destination=-33.32%2C-66.35");
  });
});
