/**
 * Estados operativos del salón de mesas.
 *
 * Una mesa sin sesión abierta está "libre". Al abrir una sesión, el estado avanza
 * con el consumo: ocupada → esperando pedido → preparando → lista para cobrar.
 * "Reservada" es un estado manual y "libre" se deriva de no tener sesión abierta.
 */

/** @summary Estados que puede tomar una sesión de mesa mientras está abierta. */
export const tableSessionStatuses = [
  "reserved",
  "occupied",
  "awaiting_order",
  "preparing",
  "ready_to_bill",
] as const;

export type TableSessionStatus = (typeof tableSessionStatuses)[number];

/** @summary Etiquetas legibles para cada estado, incluyendo la mesa libre. */
export const tableStatusLabels: Record<string, string> = {
  free: "Libre",
  reserved: "Reservada",
  occupied: "Ocupada",
  awaiting_order: "Esperando pedido",
  preparing: "Preparando",
  ready_to_bill: "Lista para cobrar",
};

/** @summary Traduce el estado de una mesa a su etiqueta operativa en español. */
export function tableStatusLabel(status: string) {
  return tableStatusLabels[status] ?? status;
}

/** @summary Estados de pedido que dejan de contar como consumo en curso de la mesa. */
const closedOrderStatuses = new Set(["delivered", "cancelled"]);

/** @summary Indica si un pedido de la mesa sigue abierto (no entregado ni cancelado). */
export function isOpenTableOrder(status: string) {
  return !closedOrderStatuses.has(status);
}

/** @summary Estados de pedido que implican trabajo en cocina o listo para servir. */
const cookingOrderStatuses = new Set(["preparing", "ready", "on_the_way"]);

/**
 * @summary Deriva el estado operativo de una sesión a partir de sus pedidos.
 *
 * - Sin pedidos todavía → "occupied" (ocupada).
 * - Con pedidos esperando (recibidos/confirmados) → "awaiting_order".
 * - Con pedidos en cocina o listos → "preparing".
 * - Sin pedidos abiertos pero con historial → "ready_to_bill" (todo servido).
 */
export function deriveSessionStatus(orderStatuses: string[]): TableSessionStatus {
  const open = orderStatuses.filter((status) => isOpenTableOrder(status));
  if (open.length === 0) {
    return orderStatuses.length > 0 ? "ready_to_bill" : "occupied";
  }
  if (open.some((status) => cookingOrderStatuses.has(status))) return "preparing";
  if (open.some((status) => status === "received" || status === "confirmed")) return "awaiting_order";
  return "occupied";
}

/** @summary Colores del plano del salón según el estado de la mesa. */
export const tableStatusStyles: Record<string, { chip: string; dot: string }> = {
  free: { chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-100", dot: "bg-emerald-400" },
  reserved: { chip: "border-violet-500/40 bg-violet-500/10 text-violet-100", dot: "bg-violet-400" },
  occupied: { chip: "border-sky-500/40 bg-sky-500/10 text-sky-100", dot: "bg-sky-400" },
  awaiting_order: { chip: "border-amber-500/40 bg-amber-500/10 text-amber-100", dot: "bg-amber-400" },
  preparing: { chip: "border-orange-500/40 bg-orange-500/10 text-orange-100", dot: "bg-orange-400" },
  ready_to_bill: { chip: "border-pink-500/40 bg-pink-500/10 text-pink-100", dot: "bg-pink-400" },
};

/** @summary Devuelve las clases visuales de una mesa según su estado ("free" si no tiene sesión). */
export function tableStatusStyle(status: string | null | undefined) {
  return tableStatusStyles[status ?? "free"] ?? tableStatusStyles.free;
}

/** @summary Color hex del brillo suave que acompaña a cada estado en el plano. */
export const tableStatusGlow: Record<string, string> = {
  free: "#34d399",
  reserved: "#a78bfa",
  occupied: "#38bdf8",
  awaiting_order: "#fbbf24",
  preparing: "#fb923c",
  ready_to_bill: "#f472b6",
};

/** @summary Devuelve el color de brillo de un estado (verde por defecto). */
export function tableStatusGlowColor(status: string | null | undefined) {
  return tableStatusGlow[status ?? "free"] ?? tableStatusGlow.free;
}

/** @summary Orden de presentación de los estados en la leyenda y los contadores del salón. */
export const tableStatusOrder = [
  "free",
  "reserved",
  "occupied",
  "awaiting_order",
  "preparing",
  "ready_to_bill",
] as const;

/** @summary Indica si un valor es un estado de sesión válido. */
export function isTableSessionStatus(value: string): value is TableSessionStatus {
  return (tableSessionStatuses as readonly string[]).includes(value);
}
