import { authorize } from "@/lib/auth";
import { stringifyCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

/** @summary Devuelve una descarga CSV aislada por negocio para el conjunto de datos elegido. */
export async function GET(request: Request) {
  const auth = await authorize("admin.access");
  if (!auth) return new Response("No autorizado", { status: 403 });
  const type = new URL(request.url).searchParams.get("type") ?? "products";
  let rows: unknown[][];
  if (type === "products") {
    const products = await prisma.product.findMany({
      where: { tenantId: auth.tenant.id },
      include: {
        categories: { include: { category: { select: { name: true } } }, take: 1 },
      },
      orderBy: { name: "asc" },
    });
    rows = [
      [
        "slug",
        "nombre",
        "descripcion",
        "precio",
        "disponibilidad",
        "estado",
        "categoria",
        "imagen",
        "destacado",
        "nuevo",
        "recomendado",
      ],
      ...products.map((product) => [
        product.slug,
        product.name,
        product.description,
        product.price,
        product.availability,
        product.status,
        product.categories[0]?.category.name ?? "",
        product.imageUrl,
        product.featured,
        product.isNew,
        product.recommended,
      ]),
    ];
  } else if (type === "orders") {
    const orders = await prisma.customerOrder.findMany({
      where: { tenantId: auth.tenant.id },
      include: { table: true },
      orderBy: { createdAt: "desc" },
      take: 100_000,
    });
    rows = [
      [
        "referencia",
        "fecha",
        "estado",
        "tipo",
        "mesa",
        "cliente",
        "telefono",
        "subtotal",
        "descuento",
        "total",
        "moneda",
      ],
      ...orders.map((order) => [
        order.reference,
        order.createdAt.toISOString(),
        order.status,
        order.orderType,
        order.table?.name ?? "",
        order.customerName,
        order.phone,
        order.subtotal,
        order.discount,
        order.total,
        order.currency,
      ]),
    ];
  } else if (type === "reservations") {
    const reservations = await prisma.reservation.findMany({
      where: { tenantId: auth.tenant.id },
      orderBy: { createdAt: "desc" },
      take: 100_000,
    });
    rows = [
      [
        "referencia",
        "fecha",
        "hora",
        "estado",
        "personas",
        "sector",
        "cliente",
        "telefono",
        "email",
        "motivo",
      ],
      ...reservations.map((reservation) => [
        reservation.reference,
        reservation.reservationDate.toISOString().slice(0, 10),
        reservation.reservationTime.toISOString().slice(11, 16),
        reservation.status,
        reservation.partySize,
        reservation.sector,
        reservation.customerName,
        reservation.phone,
        reservation.email,
        reservation.reason,
      ]),
    ];
  } else if (type === "customers") {
    const customers = await prisma.loyaltyCustomer.findMany({
      where: { tenantId: auth.tenant.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100_000,
    });
    rows = [
      ["nombre", "email", "telefono", "cumpleanos", "puntos", "nivel", "alta"],
      ...customers.map((customer) => [
        customer.name,
        customer.email,
        customer.phone,
        customer.birthday?.toISOString().slice(0, 10),
        customer.points,
        customer.tier,
        customer.createdAt.toISOString(),
      ]),
    ];
  } else return new Response("Tipo inválido", { status: 400 });
  return new Response(stringifyCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="laterne-${type}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
