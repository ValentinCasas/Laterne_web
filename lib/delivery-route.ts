import { haversineMeters } from "@/lib/geofence";

export type DeliveryRouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type DeliveryRouteStop = DeliveryRouteCoordinate & {
  id: number;
};

/** @summary Ordena paradas por cercanía desde el origen para dibujar un recorrido simple y determinista. */
export function orderDeliveryRouteStops<T extends DeliveryRouteStop>(
  origin: DeliveryRouteCoordinate,
  stops: T[],
): T[] {
  const pending = [...stops];
  const ordered: T[] = [];
  let current = origin;

  while (pending.length > 0) {
    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < pending.length; index += 1) {
      const candidate = pending[index]!;
      const distance = haversineMeters(
        current.latitude,
        current.longitude,
        candidate.latitude,
        candidate.longitude,
      );
      if (distance < closestDistance || (distance === closestDistance && candidate.id < pending[closestIndex]!.id)) {
        closestIndex = index;
        closestDistance = distance;
      }
    }
    const [next] = pending.splice(closestIndex, 1);
    if (!next) break;
    ordered.push(next);
    current = next;
  }

  return ordered;
}

/** @summary Construye una navegación externa por calles sin requerir API key dentro de MenuClick. */
export function googleMapsRouteUrl(
  origin: DeliveryRouteCoordinate,
  orderedStops: DeliveryRouteStop[],
) {
  const destination = orderedStops.at(-1);
  if (!destination) return null;
  const parameters = new URLSearchParams({
    api: "1",
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "driving",
  });
  const waypoints = orderedStops.slice(0, -1);
  if (waypoints.length > 0) {
    parameters.set(
      "waypoints",
      waypoints.map((stop) => `${stop.latitude},${stop.longitude}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}
