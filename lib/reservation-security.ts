import { createHash, randomBytes } from "node:crypto";
import { getConfig } from "@/lib/config";

/** @summary Genera una referencia breve que el cliente puede conservar para identificar su reserva. */
export function reservationReference(date = new Date()) {
  const day = date.toISOString().slice(2, 10).replaceAll("-", "");
  return `RES-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** @summary Anonimiza una dirección de red para aplicar controles de abuso sin conservarla en claro. */
export function reservationAddressHash(address: string) {
  return createHash("sha256")
    .update(`${getConfig().authSecret}:reservation:${address}`)
    .digest("hex");
}
