import type { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { getConfig } from "@/lib/config";

/** @summary Genera un token privado para que un cliente frecuente administre su perfil. */
export function loyaltyToken() {
  return randomBytes(24).toString("base64url");
}

/** @summary Protege el token personal antes de compararlo o almacenarlo en la base. */
export function loyaltyTokenHash(token: string) {
  return createHash("sha256")
    .update(`${getConfig().authSecret}:loyalty:${token}`)
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

/**
 * @summary Acredita puntos a un cliente frecuente cuando un pedido se entrega.
 * Es idempotente por referencia de pedido y debe ejecutarse con la misma
 * transacción que marca el pedido como entregado.
 */
export async function awardOrderLoyalty(
  transaction: Prisma.TransactionClient,
  order: { id: number; customerId: number | null; reference: string; total: number | string },
) {
  if (!order.customerId) return;
  const existingReward = await transaction.loyaltyTransaction.findFirst({
    where: { customerId: order.customerId, reference: order.reference },
  });
  if (existingReward) return;
  const points = loyaltyPoints(Number(order.total));
  const customer = await transaction.loyaltyCustomer.update({
    where: { id: order.customerId },
    data: { points: { increment: points } },
  });
  await transaction.loyaltyCustomer.update({
    where: { id: customer.id },
    data: { tier: loyaltyTier(customer.points) },
  });
  await transaction.loyaltyTransaction.create({
    data: {
      customerId: customer.id,
      points,
      reason: "Pedido entregado",
      reference: order.reference,
    },
  });
}
