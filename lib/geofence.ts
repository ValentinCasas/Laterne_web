/**
 * @summary Validación geográfica de pedidos de mesa (geofencing).
 * El servidor nunca confía en la ubicación del cliente: calcula la distancia
 * entre las coordenadas reportadas y las del establecimiento usando la fórmula
 * de Haversine y compara contra el radio configurado en la sucursal.
 */

/** @summary Máxima tolerancia de precisión GPS aceptada para no generar falsos negativos absurdos. */
export const MAX_GPS_ACCURACY_TOLERANCE_METERS = 500;

/** @summary Radio por defecto de la zona habilitada cuando la sucursal no lo define. */
export const DEFAULT_GEOFENCE_RADIUS_METERS = 150;

/** @summary Mensaje mostrado al cliente cuando está fuera del área habilitada. */
export const GEOFENCE_OUTSIDE_MESSAGE =
  "No podemos confirmar el pedido para esta mesa porque tu ubicación está fuera del área habilitada del local.";

/** @summary Mensaje mostrado cuando la ubicación no pudo verificarse (permiso denegado o sin señal). */
export const GEOFENCE_UNVERIFIED_MESSAGE =
  "No pudimos verificar tu ubicación. Para realizar un pedido desde una mesa necesitamos confirmar que estás en el establecimiento.";

/**
 * @summary Calcula la distancia en metros entre dos coordenadas (fórmula de Haversine).
 * @returns Distancia en metros, o `Infinity` si alguna coordenada no es finita.
 */
export function haversineMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  if (
    !Number.isFinite(latitudeA) ||
    !Number.isFinite(longitudeA) ||
    !Number.isFinite(latitudeB) ||
    !Number.isFinite(longitudeB)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const radiusEarth = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * radiusEarth * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type GeofenceConfig = {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
};

export type GeofenceClientLocation = {
  latitude: number;
  longitude: number;
  /** Precisión reportada por el navegador en metros (opcional). */
  accuracy?: number;
};

/**
 * @summary Decide si la ubicación del cliente está dentro del área habilitada.
 * El radio efectivo suma la precisión GPS reportada (acotada a un máximo
 * razonable) para evitar falsos negativos por el error del dispositivo.
 */
export function isLocationWithinGeofence(
  config: GeofenceConfig,
  location: GeofenceClientLocation | null | undefined,
): { ok: boolean; reason: "disabled" | "missing" | "outside" | "ok" } {
  if (!config.enabled || !config.latitude || !config.longitude) return { ok: true, reason: "disabled" };
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return { ok: false, reason: "missing" };
  }
  const radius = config.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;
  const accuracy = Math.min(
    Math.max(Number(location.accuracy) || 0, 0),
    MAX_GPS_ACCURACY_TOLERANCE_METERS,
  );
  const distance = haversineMeters(config.latitude, config.longitude, location.latitude, location.longitude);
  return distance <= radius + accuracy ? { ok: true, reason: "ok" } : { ok: false, reason: "outside" };
}
