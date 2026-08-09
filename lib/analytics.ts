import { createHash } from "node:crypto";

export const publicAnalyticsEvents = [
  "page.view",
  "menu.open",
  "menu.search",
  "menu.search_empty",
  "category.view",
  "product.view",
  "product.add",
  "product.favorite",
  "order.started",
  "order.completed",
  "whatsapp.click",
  "reservation.started",
  "reservation.completed",
  "testimonial.completed",
  "model.open",
  "model.screenshot",
  "ar.started",
  "social.click",
] as const;

/** @summary Crea una huella no reversible para agrupar actividad sin almacenar identificadores en claro. */
export function analyticsHash(kind: "session" | "address", value: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "development-only-change-me"}:analytics:${kind}:${value}`)
    .digest("hex");
}

/** @summary Limita metadatos analíticos a valores escalares, nombres seguros y tamaños pequeños. */
export function sanitizeAnalyticsMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string | number | boolean> = {};
  for (const [key, item] of Object.entries(value).slice(0, 12)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key)) continue;
    if (typeof item === "boolean") result[key] = item;
    if (typeof item === "number" && Number.isFinite(item)) result[key] = item;
    if (typeof item === "string") result[key] = item.slice(0, 120);
  }
  return Object.keys(result).length ? result : undefined;
}
