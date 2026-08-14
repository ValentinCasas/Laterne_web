import { createHash, randomBytes } from "node:crypto";

/** @summary Genera la referencia breve y legible que identifica un pedido almacenado. */
export function orderReference(date = new Date(), prefix = "PED") {
  const day = date.toISOString().slice(2, 10).replaceAll("-", "");
  const safePrefix =
    prefix
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 12) || "PED";
  return `${safePrefix}-${day}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** @summary Crea un token privado para consultar un pedido sin exponer identificadores internos. */
export function orderPublicToken() {
  return randomBytes(24).toString("base64url");
}

/** @summary Convierte un token sensible en una huella segura antes de almacenarlo. */
export function orderTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** @summary Anonimiza una dirección de red para limitar abuso sin conservar datos en claro. */
export function orderAddressHash(address: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:order:${address}`)
    .digest("hex");
}
