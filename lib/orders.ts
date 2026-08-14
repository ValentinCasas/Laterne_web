export const orderStatuses = [
  "received",
  "confirmed",
  "preparing",
  "ready",
  "on_the_way",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

/** @summary Traduce el estado interno de un pedido a una etiqueta clara para clientes y operadores. */
export function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    received: "Recibido",
    confirmed: "Confirmado",
    preparing: "En preparación",
    ready: "Listo",
    on_the_way: "En camino",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };
  return labels[status] ?? status;
}

/** @summary Normaliza un número telefónico para generar enlaces compatibles con WhatsApp. */
export function whatsappPhone(value: string) {
  return value.replace(/\D/g, "");
}
