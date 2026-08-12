import { NextResponse } from "next/server";
import { z } from "zod";
import { orderAddressHash, orderPublicToken, orderReference, orderTokenHash } from "@/lib/orders";
import { loyaltyTokenHash } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";
import { productAvailableAt } from "@/lib/product-availability";
import { resolveOrderPromotion, type PromotionCandidate, type PromotionItem } from "@/lib/promotion";

const orderInput = z.object({
  customerName: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(6).max(60),
  email: z.string().trim().email().max(190).optional().or(z.literal("")),
  orderType: z.enum(["takeaway", "dine_in", "delivery"]),
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
  const routeBranchSlug = request.headers.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es") || null;
  const routeBranch = routeBranchSlug
    ? await prisma.branch.findFirst({ where: { tenantId: tenant.id, slug: routeBranchSlug, active: true } })
    : null;
  if (routeBranchSlug && !routeBranch) {
    return NextResponse.json({ error: "La sucursal indicada en la URL no está disponible" }, { status: 404 });
  }
  const selectedBranch = !routeBranchSlug && parsed.data.branchId
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
  if (!(await prisma.branchLicense.findFirst({ where: { tenantId: tenant.id, branchId: branch.id, status: { in: ["ACTIVE", "TRIAL", "PAYMENT_PENDING", "GRACE_PERIOD"] } } }))) {
    return NextResponse.json({ error: "La sucursal no está operativa" }, { status: 409 });
  }
  if (parsed.data.orderType === "dine_in" && parsed.data.tableCode && !table) {
    return NextResponse.json({ error: "La mesa indicada no existe o no está disponible" }, { status: 409 });
  }
  if (parsed.data.orderType === "delivery" && !parsed.data.address) {
    return NextResponse.json({ error: "Ingresá la dirección de entrega" }, { status: 400 });
  }

  const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
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
  });
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
  if (
    requestedAt &&
    (requestedAt.getTime() < Date.now() - 5 * 60 * 1000 ||
      requestedAt.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000)
  ) {
    return NextResponse.json({ error: "Elegí un horario dentro de los próximos 30 días" }, { status: 400 });
  }
  const quantities = new Map<number, number>();
  for (const item of calculatedItems) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
  }
  const trackedStocks = await prisma.inventoryStock.findMany({
    where: { tenantId: tenant.id, branchId: branch.id, productId: { in: productIds }, tracked: true },
  });
  const unavailableStock = trackedStocks.find(
    (stock) => Number(stock.current) < (quantities.get(stock.productId) ?? 0),
  );
  if (unavailableStock) {
    const product = productMap.get(unavailableStock.productId);
    return NextResponse.json(
      { error: `${product?.name ?? "Un producto"} no tiene stock suficiente` },
      { status: 409 },
    );
  }

  const reference = await uniqueReference(branch.orderPrefix);
  const token = orderPublicToken();
  try {
    await prisma.$transaction(async (transaction) => {
      const order = await transaction.customerOrder.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          tableId: table?.id ?? null,
          customerId: customer?.id ?? null,
          reference,
          publicTokenHash: orderTokenHash(token),
          status: "received",
          orderType: parsed.data.orderType,
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
          source: table ? `table:${table.code}` : "website",
          ipHash,
          items: { create: calculatedItems },
          history: { create: { toStatus: "received", note: "Pedido creado desde la carta" } },
        },
      });
      if (idempotencyKey) {
        await transaction.orderIdempotency.create({
          data: { tenantId: tenant.id, key: idempotencyKey, orderId: order.id, reference, token, total },
        });
      }
      for (const stock of trackedStocks) {
        const quantity = quantities.get(stock.productId) ?? 0;
        if (!quantity) continue;
        const result = await transaction.inventoryStock.updateMany({
          where: { id: stock.id, tracked: true, current: { gte: quantity } },
          data: { current: { decrement: quantity } },
        });
        if (result.count !== 1) throw new Error("El stock cambió mientras confirmabas el pedido");
        const updated = await transaction.inventoryStock.findUniqueOrThrow({ where: { id: stock.id } });
        await transaction.stockMovement.create({
          data: {
            tenantId: tenant.id,
            stockId: stock.id,
            orderId: order.id,
            type: "order",
            quantity: -quantity,
            balanceAfter: updated.current,
            reason: `Pedido ${reference}`,
          },
        });
        if (Number(updated.current) <= Number(updated.minimum)) {
          await transaction.notification.create({
            data: {
              tenantId: tenant.id,
              branchId: branch.id,
              type: "stock.low",
              title: `Stock bajo · ${productMap.get(stock.productId)?.name ?? "Producto"}`,
              message: `${branch.name}: quedaron ${Number(updated.current)} ${updated.unit}.`,
              link: "/admin/inventario",
            },
          });
        }
      }
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
          reason instanceof Error && reason.message.includes("stock")
            ? reason.message
            : "No se pudo confirmar el pedido",
      },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, reference, token, status: "received", total }, { status: 201 });
}
