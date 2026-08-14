import { createHash, randomBytes } from "node:crypto";

/** @summary Genera una referencia breve que el cliente puede conservar para identificar su reserva. */
export function reservationReference(date = new Date()) {
  const day = date.toISOString().slice(2, 10).replaceAll("-", "");
  return `RES-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** @summary Anonimiza una dirección de red para aplicar controles de abuso sin conservarla en claro. */
export function reservationAddressHash(address: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:reservation:${address}`)
    .digest("hex");
}
