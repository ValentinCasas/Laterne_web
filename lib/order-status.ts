import { orderStatuses, orderStatusLabel, type OrderStatus } from "@/lib/orders";

/** @summary Modalidades operativas admitidas en un pedido. */
export const orderTypeValues = ["takeaway", "dine_in", "delivery"] as const;

export type OrderType = (typeof orderTypeValues)[number];

/**
 * @summary Transiciones válidas para retiro y consumo en mesa.
 * El avance es por pasos para evitar saltos accidentales (Recibido → Entregado).
 * La cancelación es posible desde cualquier estado activo.
 */
const standardTransitions: Record<OrderStatus, OrderStatus[]> = {
  received: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  on_the_way: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

/**
 * @summary Transiciones válidas para delivery: suman la etapa "En camino" antes de entregar.
 */
const deliveryTransitions: Record<OrderStatus, OrderStatus[]> = {
  ...standardTransitions,
  ready: ["on_the_way", "delivered", "cancelled"],
};

/** @summary Devuelve los estados a los que se puede avanzar desde uno dado según la modalidad. */
export function allowedTransitions(status: OrderStatus, orderType: OrderType): OrderStatus[] {
  const rules = orderType === "delivery" ? deliveryTransitions : standardTransitions;
  return rules[status] ?? [];
}

/** @summary Verifica si una transición concreta es válida para la modalidad del pedido. */
export function canTransition(from: OrderStatus, to: OrderStatus, orderType: OrderType): boolean {
  return allowedTransitions(from, orderType).includes(to);
}

/** @summary Devuelve un mensaje claro cuando una transición no es válida, o null si lo es. */
export function transitionError(from: OrderStatus, to: OrderStatus, orderType: OrderType): string | null {
  if (canTransition(from, to, orderType)) return null;
  const allowed = allowedTransitions(from, orderType);
  if (allowed.length === 0) {
    return `El pedido ya llegó a "${orderStatusLabel(from)}" y no admite más cambios de estado.`;
  }
  return `No se puede pasar de "${orderStatusLabel(from)}" a "${orderStatusLabel(to)}". Los estados permitidos son: ${allowed
    .map(orderStatusLabel)
    .join(", ")}.`;
}

/** @summary Normaliza una modalidad almacenada a un tipo conocido para validar transiciones. */
export function asOrderType(value: string): OrderType {
  return orderTypeValues.includes(value as OrderType) ? (value as OrderType) : "takeaway";
}

/**
 * @summary Devuelve la secuencia de estados activos esperada para mostrar el progreso público.
 * Se deriva de la máquina de transiciones para no duplicar reglas: retiro y mesa
 * terminan en "Entregado", mientras que delivery agrega "En camino".
 */
export function orderFlow(orderType: OrderType): OrderStatus[] {
  const rules = orderType === "delivery" ? deliveryTransitions : standardTransitions;
  const flow: OrderStatus[] = [];
  let current: OrderStatus = "received";
  flow.push(current);
  for (let step = 0; step < orderStatuses.length; step += 1) {
    const next: OrderStatus | undefined = rules[current].find((candidate) => candidate !== "cancelled");
    if (!next) break;
    flow.push(next);
    current = next;
  }
  return flow;
}
