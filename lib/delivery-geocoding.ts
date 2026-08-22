import "server-only";
import { z } from "zod";
import { getConfig } from "@/lib/config";

const nominatimCandidate = z.object({
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
});

export type DeliveryGeocodingCandidate = {
  latitude: number;
  longitude: number;
  label: string;
  provider: "nominatim";
};

export class DeliveryGeocodingUnavailableError extends Error {}

let nextAllowedRequestAt = 0;

/** @summary Busca candidatos sin guardar coordenadas; una persona debe confirmar el resultado antes de persistirlo. */
export async function geocodeDeliveryAddress(address: string): Promise<DeliveryGeocodingCandidate[]> {
  const config = getConfig().deliveryGeocoding;
  if (config.provider !== "nominatim" || !config.endpoint || !config.userAgent) {
    throw new DeliveryGeocodingUnavailableError(
      "No hay un proveedor de geocodificación configurado. Podés cargar latitud y longitud manualmente sin interrumpir Delivery.",
    );
  }

  // Límite defensivo de una consulta por segundo por proceso. El resultado confirmado queda guardado en la entrega.
  const delay = Math.max(0, nextAllowedRequestAt - Date.now());
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  nextAllowedRequestAt = Date.now() + 1_000;

  const url = new URL(config.endpoint);
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "3");
  url.searchParams.set("addressdetails", "0");
  const response = await fetch(url, {
    headers: { "User-Agent": config.userAgent, "Accept-Language": "es-AR,es;q=0.9" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`El geocodificador respondió ${response.status}`);
  const parsed = z.array(nominatimCandidate).safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw new Error("El geocodificador devolvió una respuesta inválida");
  return parsed.data.flatMap((candidate) => {
    const latitude = Number(candidate.lat);
    const longitude = Number(candidate.lon);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return [];
    return [{ latitude, longitude, label: candidate.display_name, provider: "nominatim" as const }];
  });
}
