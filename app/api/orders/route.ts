import { NextResponse } from "next/server";
import { z } from "zod";
import { orderAddressHash, orderPublicToken, orderReference, orderTokenHash } from "@/lib/order-security";
import { loyaltyTokenHash } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";
import { productAvailableAt } from "@/lib/product-availability";
import { assertStockAvailability } from "@/lib/order-stock";
import { inventoryPolicy, trackedStocksForPlan } from "@/lib/inventory";
import { buildRecipeConsumptionPlan, consumeRecipeStock } from "@/lib/recipe-stock";
import { deriveSessionStatus } from "@/lib/table-status";
import { resolveOrderPromotion, type PromotionCandidate, type PromotionItem } from "@/lib/promotion";
import {
  availableOrderSlots,
  isAvailableOrderSlot,
  ORDER_MINIMUM_LEAD_MINUTES,
  orderTimeText,
} from "@/lib/order-scheduling";

/**
 * @summary Valida la entrada relacionada con los pedidos.
 */
const orderInput = z.object({
  customerName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(60),
  email: z.string().trim().email().max(190).optional().or(z.literal("")),
  orderType: z.enum(["takeaway", "dine_in", "delivery"]),
  channel: z.enum(["SALON", "MOSTRADOR", "DELIVERY", "ONLINE"]).default("DELIVERY"),
  source: z.enum(["ADMIN", "MENUCLICK_WEB", "TABLE_QR", "POS", "EXTERNAL_INTEGRATOR", "API"]).default("MENUCLICK_WEB"),
  branchId: z.coerce.number().int().positive().optional(),
  tableCode: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  requestedTime: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(1500).optional(),
  promotionCode: z.string().trim().max(80).optional(),
  tip: z.coerce.number().min(0).max(1_000_000).default(0),
  website: z.string().max(0).optional(),
  loyaltyToken: z.string().max(100).optional(),
  paymentMethod: z.enum(["on_delivery", "cash", "card_on_delivery", "transfer"]).default("on_delivery"),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().int().min(1).max(30),
        variantId: z.coerce.number().int().positive().optional().nullable(),
        extraIds: z.array(z.coerce.number().int().positive()).max(20).default([]),
        notes: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(80),
});

/** @summary Recupera la dirección declarada por el proxy para aplicar protección contra abuso. */
function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** @summary Genera una referencia de pedido que no se encuentre utilizada en la base. */
async function uniqueReference(prefix?: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = orderReference(new Date(), prefix);
    const exists = await prisma.customerOrder.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  throw new Error("No se pudo generar la referencia del pedido");
}

/** @summary Valida precios en el servidor, almacena el pedido y devuelve su acceso de seguimiento. */
export async function POST(request: Request) {
  const parsed = orderInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos y productos del pedido" }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });

  const tenant = await getDefaultTenant();
  const idempotencyKey = parsed.data.idempotencyKey?.trim() || null;
  if (idempotencyKey) {
    // Reintento de un pedido ya confirmado: devuelve la misma respuesta sin duplicar la operación.
    const existing = await prisma.orderIdempotency.findUnique({
      where: { tenantId_key: { tenantId: tenant.id, key: idempotencyKey } },
    });
    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          reference: existing.reference,
          token: existing.token,
          status: "received",
          total: Number(existing.total),
        },
        { status: 201 },
      );
    }
  }
  const ipHash = orderAddressHash(requestAddress(request));
  const recent = await prisma.customerOrder.count({
    where: { ipHash, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } },
  });
  if (recent >= 8) {
    return NextResponse.json({ error: "Alcanzaste el límite temporal de pedidos" }, { status: 429 });
  }

  const table = parsed.data.tableCode
    ? await prisma.diningTable.findFirst({
        where: { tenantId: tenant.id, code: parsed.data.tableCode, active: true },
        include: { branch: true },
      })
    : null;
  const routeBranchSlug =
    request.headers.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es") || null;
  const routeBranch = routeBranchSlug
    ? await prisma.branch.findFirst({ where: { tenantId: tenant.id, slug: routeBranchSlug, active: true } })
    : null;
  if (routeBranchSlug && !routeBranch) {
    return NextResponse.json({ error: "La sucursal indicada en la URL no está disponible" }, { status: 404 });
  }
  const selectedBranch =
    !routeBranchSlug && parsed.data.branchId
      ? await prisma.branch.findFirst({
          where: { id: parsed.data.branchId, tenantId: tenant.id, active: true },
        })
      : null;
  if (!routeBranchSlug && parsed.data.branchId && !selectedBranch) {
    return NextResponse.json({ error: "La sucursal seleccionada ya no está disponible" }, { status: 409 });
  }
  if (routeBranch && parsed.data.branchId && parsed.data.branchId !== routeBranch.id) {
    return NextResponse.json({ error: "La sucursal del pedido no coincide con la URL" }, { status: 409 });
  }
  const requestedBranch = routeBranch ?? selectedBranch;
  if (table?.branch && requestedBranch && table.branch.id !== requestedBranch.id) {
    return NextResponse.json({ error: "La mesa no pertenece a la sucursal seleccionada" }, { status: 409 });
  }
  const branch =
    routeBranch ??
    table?.branch ??
    selectedBranch ??
    (await prisma.branch.findFirst({
      where: { tenantId: tenant.id, active: true },
      orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
    }));
  if (!branch)
    return NextResponse.json({ error: "No hay una sucursal activa para recibir pedidos" }, { status: 409 });
  if (
    !(await prisma.branchLicense.findFirst({
      where: {
        tenantId: tenant.id,
        branchId: branch.id,
        status: { in: ["ACTIVE", "TRIAL", "PAYMENT_PENDING", "GRACE_PERIOD"] },
      },
    }))
  ) {
    return NextResponse.json({ error: "La sucursal no está operativa" }, { status: 409 });
  }
  if (parsed.data.orderType === "dine_in" && parsed.data.tableCode && !table) {
    return NextResponse.json({ error: "La mesa indicada no existe o no está disponible" }, { status: 409 });
  }
  if (parsed.data.orderType === "delivery" && !parsed.data.address) {
    return NextResponse.json({ error: "Ingresá la dirección de entrega" }, { status: 400 });
  }

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
  const [products, openingHourRecords] = await Promise.all([
    prisma.product.findMany({
      where: {
        tenantId: tenant.id,
        id: { in: productIds },
        OR: [{ status: "published" }, { status: "scheduled", publishAt: { lte: new Date() } }],
        branchAssignments: { some: { branchId: branch.id, active: true } },
      },
      include: {
        variants: { where: { active: true } },
        extras: { where: { active: true } },
      },
    }),
    prisma.openingHour.findMany({ where: { tenantId: tenant.id, branchId: branch.id } }),
  ]);
  const productMap = new Map(products.map((product) => [product.id, product]));
  if (products.length !== productIds.length) {
    return NextResponse.json({ error: "Uno de los productos ya no está disponible" }, { status: 409 });
  }

  let calculatedItems;
  try {
    calculatedItems = parsed.data.items.map((input) => {
      const product = productMap.get(input.productId);
      if (
        !product ||
        product.availability?.toLowerCase() === "agotado" ||
        !productAvailableAt(
          product.availableDays,
          product.availableStartTime,
          product.availableEndTime,
          new Date(),
          tenant.timeZone,
        )
      ) {
        throw new Error("Uno de los productos está agotado");
      }
      const variant = input.variantId
        ? product.variants.find((candidate) => candidate.id === input.variantId)
        : null;
      if (input.variantId && !variant) {
        throw new Error("La variante seleccionada ya no está disponible");
      }
      const selectedExtras = product.extras.filter((extra) => input.extraIds.includes(extra.id));
      if (selectedExtras.length !== new Set(input.extraIds).size) {
        throw new Error("Uno de los agregados ya no está disponible");
      }
      const unitPrice = Number(product.promotionalPrice ?? product.price ?? 0);
      const variantPrice = Number(variant?.priceAdjustment ?? 0);
      const extrasTotal = selectedExtras.reduce((sum, extra) => sum + Number(extra.price), 0);
      const lineTotal = (unitPrice + variantPrice + extrasTotal) * input.quantity;
      return {
        productId: product.id,
        productName: product.name,
        quantity: input.quantity,
        unitPrice,
        variantName: variant?.name ?? null,
        variantPrice,
        extras: selectedExtras.map((extra) => ({
          id: extra.id,
          name: extra.name,
          price: Number(extra.price),
        })),
        extrasTotal,
        notes: input.notes || null,
        lineTotal,
      };
    });
  } catch (reason) {
    return NextResponse.json(
      { error: reason instanceof Error ? reason.message : "No se pudo validar el pedido" },
      { status: 409 },
    );
  }
  const subtotal = calculatedItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const [promotions, productCategories] = await Promise.all([
    prisma.promotion.findMany({
      where: { tenantId: tenant.id, branchId: branch.id, status: { in: ["published", "scheduled"] } },
      include: {
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
    }),
    prisma.productCategory.findMany({
      where: { tenantId: tenant.id, productId: { in: productIds } },
      select: { productId: true, categoryId: true },
    }),
  ]);
  const categoryByProduct = new Map<number, number[]>();
  for (const link of productCategories) {
    const categories = categoryByProduct.get(link.productId) ?? [];
    categories.push(link.categoryId);
    categoryByProduct.set(link.productId, categories);
  }
  const candidates: PromotionCandidate[] = promotions.map((promotion) => ({
    id: promotion.id,
    name: promotion.name,
    type: promotion.type,
    discountValue: promotion.discountValue === null ? null : Number(promotion.discountValue),
    minimumPurchase: promotion.minimumPurchase === null ? null : Number(promotion.minimumPurchase),
    buyQuantity: promotion.buyQuantity,
    receiveQuantity: promotion.receiveQuantity,
    code: promotion.code,
    usageLimit: promotion.usageLimit,
    perCustomerLimit: promotion.perCustomerLimit,
    usedCount: promotion.usedCount,
    status: promotion.status,
    publishAt: promotion.publishAt,
    startAt: promotion.startAt,
    endAt: promotion.endAt,
    startTime: promotion.startTime,
    endTime: promotion.endTime,
    daysOfWeek: promotion.daysOfWeek,
    priority: promotion.priority,
    productIds: promotion.products.map((link) => link.productId),
    categoryIds: promotion.categories.map((link) => link.categoryId),
  }));
  const promotionItems: PromotionItem[] = calculatedItems.map((item) => ({
    productId: item.productId,
    categoryIds: categoryByProduct.get(item.productId) ?? [],
    unitPrice: item.unitPrice,
    perUnit: item.unitPrice + item.variantPrice + item.extrasTotal,
    linePrice: item.lineTotal,
    quantity: item.quantity,
  }));
  const promotion = resolveOrderPromotion(
    candidates,
    promotionItems,
    subtotal,
    parsed.data.promotionCode,
    new Date(),
    tenant.timeZone,
    tenant.defaultCurrency,
  );
  const discount = promotion.discount;
  const tip = parsed.data.tip;
  const deliveryFee = parsed.data.orderType === "delivery" ? Number(branch.deliveryFee) : 0;
  if (parsed.data.orderType === "delivery" && subtotal < Number(branch.minimumOrder)) {
    return NextResponse.json(
      {
        error: `El pedido mínimo para ${branch.name} es ${tenant.defaultCurrency} ${Number(branch.minimumOrder).toFixed(2)}`,
      },
      { status: 409 },
    );
  }
  const appliedPromotion =
    promotion.promotionId !== null ? promotions.find((item) => item.id === promotion.promotionId) : null;
  const couponEmailKey = (parsed.data.email ?? "").trim().toLowerCase();
  if (appliedPromotion?.code) {
    if (appliedPromotion.usageLimit !== null && appliedPromotion.usedCount >= appliedPromotion.usageLimit) {
      return NextResponse.json({ error: "El cupón ya agotó sus usos" }, { status: 409 });
    }
    if (appliedPromotion.perCustomerLimit !== null && couponEmailKey) {
      const customerUses = await prisma.promotionUsage.count({
        where: { promotionId: appliedPromotion.id, customerEmail: couponEmailKey },
      });
      if (customerUses >= appliedPromotion.perCustomerLimit) {
        return NextResponse.json({ error: "Ya usaste este cupón para este correo" }, { status: 409 });
      }
    }
  }
  const total = Math.max(0, subtotal - discount + deliveryFee + tip);
  const customer = parsed.data.loyaltyToken
    ? await prisma.loyaltyCustomer.findFirst({
        where: {
          tenantId: tenant.id,
          publicTokenHash: loyaltyTokenHash(parsed.data.loyaltyToken),
          deletedAt: null,
        },
      })
    : null;
  const requestedAt = parsed.data.requestedTime ? new Date(parsed.data.requestedTime) : null;
  if (requestedAt && Number.isNaN(requestedAt.getTime())) {
    return NextResponse.json({ error: "El horario solicitado no es válido" }, { status: 400 });
  }
  const leadMinutes = Math.max(
    ORDER_MINIMUM_LEAD_MINUTES,
    ...products.map((product) => Number(product.preparationMinutes ?? 0)),
  );
  const validSlots = availableOrderSlots({
    hours: openingHourRecords.map((opening) => ({
      dayOfWeek: opening.dayOfWeek,
      morningStartTime: orderTimeText(opening.morningStartTime),
      morningEndTime: orderTimeText(opening.morningEndTime),
      eveningStartTime: orderTimeText(opening.eveningStartTime),
      eveningEndTime: orderTimeText(opening.eveningEndTime),
    })),
    timeZone: tenant.timeZone,
    now: new Date(),
    leadMinutes,
  });
  if (parsed.data.orderType !== "dine_in" && !requestedAt) {
    return NextResponse.json(
      { error: "Elegí un horario disponible para recibir el pedido" },
      { status: 400 },
    );
  }
  if (requestedAt && !isAvailableOrderSlot(requestedAt, validSlots)) {
    const next = validSlots[0];
    return NextResponse.json(
      {
        error: next
          ? `Ese horario ya no está disponible. Próxima disponibilidad: ${next.date} a las ${next.time}`
          : "Ya no quedan horarios disponibles dentro de los próximos 30 días",
      },
      { status: 409 },
    );
  }
  const quantities = new Map<number, number>();
  for (const item of calculatedItems) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  const productName = (productId: number) => productMap.get(productId)?.name ?? "Producto";

  // Plan de consumo: expande recetas (subrecetas + merma) y combos hasta la materia prima.
  let consumptionPlan: Awaited<ReturnType<typeof buildRecipeConsumptionPlan>>;
  try {
    consumptionPlan = await buildRecipeConsumptionPlan(tenant.id, quantities);
  } catch (reason) {
    return NextResponse.json(
      { error: reason instanceof Error ? reason.message : "No se pudo calcular el consumo de ingredientes" },
      { status: 409 },
    );
  }
  // Política de stock: estricta impide vender sin stock; permisiva vende con advertencia.
  const policy = await inventoryPolicy(tenant.id);
  const allowNegative = policy.stockPolicy === "warn";
  let trackedStocks: Awaited<ReturnType<typeof assertStockAvailability>> = [];
  try {
    trackedStocks = allowNegative
      ? ((await trackedStocksForPlan(prisma, tenant.id, branch.id, consumptionPlan.plan)) as never)
      : await assertStockAvailability(tenant.id, branch.id, consumptionPlan.plan, productName);
  } catch (reason) {
    return NextResponse.json(
      { error: reason instanceof Error ? reason.message : "No se pudo validar el stock" },
      { status: 409 },
    );
  }

  const tableSession = table
    ? await prisma.tableSession.findFirst({
        where: { tenantId: tenant.id, tableId: table.id, closedAt: null },
        select: { id: true },
      })
    : null;

  const reference = await uniqueReference(branch.orderPrefix);
  const token = orderPublicToken();
  try {
    await prisma.$transaction(async (transaction) => {
      const order = await transaction.customerOrder.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          tableId: table?.id ?? null,
          tableSessionId: tableSession?.id ?? null,
          customerId: customer?.id ?? null,
          reference,
          publicTokenHash: orderTokenHash(token),
          status: "received",
          orderType: parsed.data.orderType,
          channel: parsed.data.channel,
          source: table ? `table:${table.code}` : parsed.data.source,
          customerName: parsed.data.customerName,
          phone: parsed.data.phone,
          email: parsed.data.email || null,
          notes: parsed.data.notes || null,
          deliveryAddress: parsed.data.address || null,
          requestedAt,
          subtotal,
          discount,
          promotionId: promotion.promotionId,
          promotionCode: promotion.promotionCode,
          promotionLabel: promotion.promotionLabel,
          deliveryFee,
          tip,
          total,
          currency: tenant.defaultCurrency,
          paymentMethod: parsed.data.paymentMethod,
          paymentStatus: "pending",
          ipHash,
          items: { create: calculatedItems },
          history: { create: { toStatus: "received", note: "Pedido creado desde la carta" } },
        },
      });
      if (tableSession) {
        const sessionStatuses = await transaction.customerOrder.findMany({
          where: {
            tenantId: tenant.id,
            tableSessionId: tableSession.id,
            status: { notIn: ["delivered", "cancelled"] },
          },
          select: { status: true },
        });
        await transaction.tableSession.update({
          where: { id: tableSession.id },
          data: { status: deriveSessionStatus(sessionStatuses.map((item) => item.status)) },
        });
      }
      if (idempotencyKey) {
        await transaction.orderIdempotency.create({
          data: { tenantId: tenant.id, key: idempotencyKey, orderId: order.id, reference, token, total },
        });
      }
      await consumeRecipeStock(transaction, {
        tenantId: tenant.id,
        branchId: branch.id,
        orderId: order.id,
        reference,
        plan: consumptionPlan.plan,
        stocks: trackedStocks,
        costById: consumptionPlan.costById,
        units: consumptionPlan.units,
        conversions: consumptionPlan.conversions,
        productName,
        allowNegative,
      });
      await transaction.notification.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          type: "order.new",
          title: `Nuevo pedido · ${reference}`,
          message: `${parsed.data.customerName} realizó un pedido por ${tenant.defaultCurrency} ${total.toFixed(2)}.`,
          link: "/admin/pedidos",
        },
      });
      if (appliedPromotion?.code) {
        await transaction.promotionUsage.create({
          data: {
            tenantId: tenant.id,
            promotionId: appliedPromotion.id,
            orderId: order.id,
            customerId: customer?.id ?? null,
            customerEmail: couponEmailKey || null,
          },
        });
        await transaction.promotion.update({
          where: { id: appliedPromotion.id },
          data: { usedCount: { increment: 1 } },
        });
      }
      await transaction.analyticsEvent.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          eventType: "order.completed",
          ipHash,
          path: "/pedido",
          entityType: "order",
          entityId: order.id,
          metadata: { total, itemCount: calculatedItems.reduce((sum, item) => sum + item.quantity, 0) },
        },
      });
    });
  } catch (reason) {
    if (idempotencyKey) {
      // Dos envíos simultáneos con la misma clave: el que perdió la carrera responde con el pedido ganador.
      const existing = await prisma.orderIdempotency.findUnique({
        where: { tenantId_key: { tenantId: tenant.id, key: idempotencyKey } },
      });
      if (existing) {
        return NextResponse.json(
          {
            ok: true,
            reference: existing.reference,
            token: existing.token,
            status: "received",
            total: Number(existing.total),
          },
          { status: 201 },
        );
      }
    }
    return NextResponse.json(
      {
        error:
          reason instanceof Error &&
          (reason.message.includes("stock") || reason.message.includes("convertir"))
            ? reason.message
            : "No se pudo confirmar el pedido",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, reference, token, status: "received", total }, { status: 201 });
}
