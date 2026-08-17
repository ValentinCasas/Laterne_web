/**
 * Dominio compartido del módulo Repartidores: estados de entrega, flujo de la
 * vista personal y utilidades de transición. Sin dependencias de servidor, puede
 * importarse desde clientes y servidores.
 */

/**
 * @summary Estados posibles de una entrega, incluidos los heredados del centro de entregas.
 */
export const DELIVERY_STATUSES = {
  PENDING_ASSIGNMENT: { label: "Sin asignar", badge: "bg-amber-500/15 text-amber-300" },
  ASSIGNED: { label: "Asignado", badge: "bg-sky-500/15 text-sky-300" },
  PICKED_UP: { label: "Retirado", badge: "bg-indigo-500/15 text-indigo-300" },
  ON_THE_WAY: { label: "En camino", badge: "bg-violet-500/15 text-violet-300" },
  DELIVERED: { label: "Entregado", badge: "bg-emerald-500/15 text-emerald-300" },
  INCIDENT: { label: "Incidencia", badge: "bg-orange-500/15 text-orange-300" },
  FAILED: { label: "Fallido", badge: "bg-red-500/15 text-red-300" },
  CANCELLED: { label: "Cancelado", badge: "bg-zinc-500/15 text-zinc-300" },
} as const;

export type DeliveryStatusKey = keyof typeof DELIVERY_STATUSES;

/** @summary Devuelve el dato visual de un estado, con respaldo seguro. */
export function deliveryStatusMeta(status: string | null | undefined) {
  return (
    DELIVERY_STATUSES[status as DeliveryStatusKey] ?? {
      label: status || "Desconocido",
      badge: "bg-zinc-500/15 text-zinc-300",
    }
  );
}

/**
 * @summary Estados que se consideran "en curso" para el repartidor: son los que
 * aceptan avanzar en el flujo personal.
 */
export const DRIVER_ACTIVE_STATUSES = new Set<DeliveryStatusKey>([
  "ASSIGNED",
  "PICKED_UP",
  "ON_THE_WAY",
]);

/** @summary Flujo de la vista personal del repartidor: un único camino hacia adelante. */
export const DRIVER_DELIVERY_FLOW: Record<string, ReadonlyArray<string>> = {
  ASSIGNED: ["PICKED_UP", "INCIDENT"],
  PICKED_UP: ["ON_THE_WAY", "INCIDENT"],
  ON_THE_WAY: ["DELIVERED", "INCIDENT"],
};

/** @summary Indica si la transición es válida en la vista personal del repartidor. */
export function canDriverTransition(from: string, to: string) {
  const allowed = DRIVER_DELIVERY_FLOW[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** @summary Siguiente estado normal en el flujo personal. */
export function nextDriverStatus(from: string): string | null {
  const allowed = DRIVER_DELIVERY_FLOW[from];
  if (!Array.isArray(allowed)) return null;
  return allowed.find((candidate) => candidate !== "INCIDENT") ?? null;
}

/** @summary Devuelve los timestamps que deben actualizarse al pasar a cada estado. */
export function deliveryStatusTimestamps(status: string): {
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
} {
  const now = new Date();
  if (status === "ASSIGNED") return { assignedAt: now };
  if (status === "PICKED_UP") return { pickedUpAt: now };
  if (status === "DELIVERED") return { deliveredAt: now };
  return {};
}
