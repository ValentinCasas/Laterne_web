import { createHash, randomBytes } from "node:crypto";

/** @summary Genera un token privado para que un cliente frecuente administre su perfil. */
export function loyaltyToken() {
  return randomBytes(24).toString("base64url");
}

/** @summary Protege el token personal antes de compararlo o almacenarlo en la base. */
export function loyaltyTokenHash(token: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:loyalty:${token}`)
    .digest("hex");
}

/** @summary Calcula el nivel de fidelidad correspondiente a un saldo acumulado. */
export function loyaltyTier(points: number) {
  if (points >= 1000) return "diamante";
  if (points >= 500) return "oro";
  if (points >= 200) return "plata";
  return "inicial";
}

/** @summary Convierte el total entregado en puntos aplicando una regla simple y predecible. */
export function loyaltyPoints(total: number) {
  return Math.max(1, Math.floor(total / 1000));
}
