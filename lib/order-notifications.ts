import { prisma } from "@/lib/prisma";
import { integrationSecretConfigured } from "@/lib/integrations";
import { orderStatusLabel } from "@/lib/orders";

/**
 * Canal de notificación de cambios de estado de pedidos.
 *
 * Un cambio de estado emite siempre una notificación interna del panel. Si el
 * negocio habilita WhatsApp y el evento está configurado, se prepara el mensaje
 * y se delega en `dispatchWhatsAppOrderStatus`, que hoy no envía nada porque no
 * hay proveedor conectado. El punto de integración queda aislado: cuando exista
 * un proveedor real solo hay que implementar esa función.
 */
const orderMessageTemplates: Record<string, string> = {
  confirmed: "Tu pedido fue confirmado.",
  preparing: "Tu pedido está en preparación.",
  ready: "Tu pedido está listo.",
  on_the_way: "Tu pedido salió para entrega.",
  delivered: "Tu pedido fue entregado.",
  cancelled: "Tu pedido fue cancelado.",
};

/** @summary Estados que por defecto generan mensajes cuando no se configuraron preferencias. */
const defaultOrderNotifiableEvents = Object.keys(orderMessageTemplates).map((status) => `order.${status}`);

/** @summary Devuelve los eventos de pedido que el negocio quiere notificar. */
export async function orderNotifiableEvents(tenantId: number): Promise<Set<string>> {
  const settings = await prisma.notificationSettings.findUnique({ where: { tenantId } });
  const stored = Array.isArray(settings?.events)
    ? settings.events.filter((event): event is string => typeof event === "string")
    : [];
  const relevant = stored.filter((event) => event.startsWith("order."));
  return new Set(relevant.length ? relevant : defaultOrderNotifiableEvents);
}

/**
 * @summary Prepara el texto de WhatsApp para un estado, o null si no aplica.
 */
export function orderWhatsAppMessage(status: string, reference: string, customerName: string) {
  const template = orderMessageTemplates[status];
  if (!template) return null;
  return `${template}\nPedido ${reference} · ${customerName}`;
}

/**
 * @summary Envía un mensaje de WhatsApp si hay integración y preferencia activa.
 * Sin credenciales o proveedor implementado, no envía nada y documenta el motivo.
 */
export async function dispatchWhatsAppOrderStatus(input: {
  tenantId: number;
  branchId?: number | null;
  phone?: string | null;
  reference: string;
  customerName: string;
  status: string;
}) {
  const phone = input.phone?.replace(/\D/g, "");
  const message = orderWhatsAppMessage(input.status, input.reference, input.customerName);
  if (!phone || !message) return { sent: false, reason: "missing-phone-or-message" };
  if (!integrationSecretConfigured("whatsapp")) {
    return { sent: false, reason: "whatsapp-not-configured" };
  }
  // Punto de integración futuro con un proveedor de WhatsApp (credenciales reales
  // desde variables de entorno, nunca hardcodeadas).
  return { sent: false, reason: "provider-not-implemented" };
}

/**
 * @summary Emite la notificación de panel y delega el canal WhatsApp cuando está habilitado.
 * El panel se conserva para no perder trazabilidad aunque no haya integraciones.
 */
export async function emitOrderStatusNotification(input: {
  tenantId: number;
  branchId?: number | null;
  orderId: number;
  reference: string;
  customerName: string;
  phone?: string | null;
  status: string;
}) {
  const settings = await prisma.notificationSettings.findUnique({ where: { tenantId: input.tenantId } });
  const label = orderStatusLabel(input.status);
  const wantsPanel = settings ? settings.panel : true;
  const wantsWhatsApp = settings ? settings.whatsapp : false;

  if (wantsPanel) {
    await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        branchId: input.branchId ?? null,
        type: "order.status",
        title: `${input.reference} · ${label}`,
        message: `El pedido de ${input.customerName} cambió de estado.`,
        link: "/admin/pedidos",
      },
    });
  }

  const notifiable = await orderNotifiableEvents(input.tenantId);
  const eventKey = `order.${input.status}`;
  if (wantsWhatsApp && notifiable.has(eventKey)) {
    return dispatchWhatsAppOrderStatus(input);
  }
  return { sent: false, reason: "whatsapp-disabled" };
}
