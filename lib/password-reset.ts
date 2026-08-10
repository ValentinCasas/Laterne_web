import { createHash, randomBytes } from "node:crypto";

/** @summary Genera una credencial aleatoria de un solo uso para restablecer el acceso. */
export function passwordResetToken() {
  return randomBytes(32).toString("base64url");
}

/** @summary Protege tokens, correos y direcciones de red antes de persistirlos. */
export function passwordResetHash(kind: string, value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:password-reset:${kind}:${value}`)
    .digest("hex");
}
