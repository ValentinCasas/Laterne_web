import { createHash, randomBytes } from "node:crypto";
import { getConfig } from "@/lib/config";

/** @summary Genera una credencial aleatoria de un solo uso para restablecer el acceso. */
export function passwordResetToken() {
  return randomBytes(32).toString("base64url");
}

/** @summary Protege tokens, correos y direcciones de red antes de persistirlos. */
export function passwordResetHash(kind: string, value: string) {
  return createHash("sha256")
    .update(`${getConfig().authSecret}:password-reset:${kind}:${value}`)
    .digest("hex");
}
