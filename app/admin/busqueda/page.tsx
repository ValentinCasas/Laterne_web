import type { Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { requirePermission } from "@/lib/auth";
import { branchProductWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";
import { adminHrefForContext } from "@/lib/routes";

export const dynamic = "force-dynamic";

type SearchPageProps = { searchParams: Promise<{ q?: string }> };

type SearchResultItem = {
  id: number;
  title: string;
  description?: string;
  href: Route;
};

type SearchGroup = {
  title: string;
  items: SearchResultItem[];
};

/** @summary Busca de forma consolidada en productos, categorías, clientes, pedidos, reservas, gastos, compras, promociones, eventos y plantillas. */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const context = await requirePermission("admin.access");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const adminHref = (href: string) =>
    adminHrefForContext(
      context.tenant.slug,
      href,
      context.activeBranchId != null && context.activeBranchId > 0
        ? context.branches.find((branch) => branch.id === context.activeBranchId)?.slug
        : undefined,
      context.tenant.publicGuid,
    ) as Route;

  const tenantId = context.tenant.id;

  const safe = <T,>(promise: Promise<T>): Promise<T> =>
    promise.catch(() => [] as T);

  if (query) {
    const [
      foundProducts,
      foundCategories,
      foundCustomers,
      foundOrders,
      foundReservations,
      foundExpenses,
      foundPurchases,
      foundPromotions,
      foundEvents,
      foundTemplates,
    ] = await Promise.all([
      context.permissions.includes("product.manage")
        ? safe(
            prisma.product.findMany({
              where: { ...branchProductWhere(tenantId, context.activeBranchId), name: { contains: query } },
              select: { id: true, name: true, price: true, status: true },
              take: 12,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("product.manage")
        ? safe(
            prisma.category.findMany({
              where: { tenantId, name: { contains: query } },
              select: { id: true, name: true },
              take: 8,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("customer.manage")
        ? safe(
            prisma.loyaltyCustomer.findMany({
              where: {
                tenantId,
                OR: [
                  { name: { contains: query } },
                  { email: { contains: query } },
                  { phone: { contains: query } },
                ],
              },
              select: { id: true, name: true, email: true, phone: true, points: true },
              take: 12,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("order.manage")
        ? safe(
            prisma.customerOrder.findMany({
              where: {
                tenantId,
                OR: [
                  { reference: { contains: query } },
                  { customerName: { contains: query } },
                ],
              },
              select: { id: true, reference: true, customerName: true, status: true, orderType: true },
              take: 12,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("reservation.manage")
        ? safe(
            prisma.reservation.findMany({
              where: {
                tenantId,
                OR: [
                  { reference: { contains: query } },
                  { customerName: { contains: query } },
                ],
              },
              select: { id: true, reference: true, customerName: true, status: true },
              take: 8,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("purchase.manage")
        ? safe(
            prisma.expense.findMany({
              where: {
                tenantId,
                OR: [
                  { number: { contains: query } },
                  { notes: { contains: query } },
                ],
              },
              select: { id: true, number: true, notes: true, total: true, status: true },
              take: 10,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("purchase.manage")
        ? safe(
            prisma.purchaseOrder.findMany({
              where: {
                tenantId,
                OR: [
                  { number: { contains: query } },
                  { externalReference: { contains: query } },
                  { notes: { contains: query } },
                ],
              },
              select: { id: true, number: true, externalReference: true, status: true },
              take: 10,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("promotion.manage")
        ? safe(
            prisma.promotion.findMany({
              where: {
                tenantId,
                OR: [
                  { name: { contains: query } },
                  { code: { contains: query } },
                  { description: { contains: query } },
                ],
              },
              select: { id: true, name: true, code: true, description: true, status: true },
              take: 10,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("event.manage")
        ? safe(
            prisma.event.findMany({
              where: {
                tenantId,
                OR: [
                  { name: { contains: query } },
                  { description: { contains: query } },
                  { location: { contains: query } },
                ],
              },
              select: { id: true, name: true, description: true, date: true, status: true },
              take: 10,
            })
          )
        : Promise.resolve([]),
      context.permissions.includes("order.manage")
        ? safe(
            prisma.documentTemplate.findMany({
              where: {
                tenantId,
                OR: [
                  { name: { contains: query } },
                  { originalFilename: { contains: query } },
                ],
              },
              select: { id: true, name: true, originalFilename: true, documentType: true, active: true },
              take: 10,
            })
          )
        : Promise.resolve([]),
    ]);

    const groups: SearchGroup[] = [
      {
        title: "Productos",
        items: (foundProducts as Array<{ id: number; name: string; price: string | null; status: string }>).map(
          (item) => ({
            id: item.id,
            title: item.name,
            description: `${item.price ? `$${Number(item.price).toLocaleString("es-AR")}` : "Sin precio"} · ${item.status}`,
            href: adminHref(`/admin/productos?id=${item.id}`),
          })
        ),
      },
      {
        title: "Categorías",
        items: (foundCategories as Array<{ id: number; name: string }>).map((item) => ({
          id: item.id,
          title: item.name,
          href: adminHref(`/admin/categorias?id=${item.id}`),
        })),
      },
      {
        title: "Clientes frecuentes",
        items: (foundCustomers as Array<{
          id: number;
          name: string;
          email: string | null;
          phone: string | null;
          points: number;
        }>).map((item) => ({
          id: item.id,
          title: item.name,
          description: `${item.email || item.phone || "Sin contacto"} · ${item.points} puntos`,
          href: adminHref(`/admin/clientes-frecuentes?id=${item.id}`),
        })),
      },
      {
        title: "Pedidos",
        items: (foundOrders as Array<{
          id: number;
          reference: string;
          customerName: string;
          status: string;
          orderType: string;
        }>).map((item) => ({
          id: item.id,
          title: `${item.reference} · ${item.customerName}`,
          description: `${item.orderType.replaceAll("_", " ")} · ${item.status.replaceAll("_", " ")}`,
          href: adminHref(`/admin/pedidos?id=${item.id}`),
        })),
      },
      {
        title: "Reservas",
        items: (foundReservations as Array<{
          id: number;
          reference: string;
          customerName: string;
          status: string;
        }>).map((item) => ({
          id: item.id,
          title: `${item.reference} · ${item.customerName}`,
          description: item.status.replaceAll("_", " "),
          href: adminHref(`/admin/reservas?id=${item.id}`),
        })),
      },
      {
        title: "Gastos",
        items: (foundExpenses as Array<{
          id: number;
          number: string;
          notes: string | null;
          total: unknown;
          status: string;
        }>).map((item) => ({
          id: item.id,
          title: `${item.number}${item.notes ? ` · ${item.notes}` : ""}`,
          description: `$${item.total ? Number(item.total).toLocaleString("es-AR") : "0"} · ${item.status.replaceAll("_", " ")}`,
          href: adminHref(`/admin/gastos?id=${item.id}`),
        })),
      },
      {
        title: "Compras",
        items: (foundPurchases as Array<{
          id: number;
          number: string;
          externalReference: string | null;
          status: string;
        }>).map((item) => ({
          id: item.id,
          title: `${item.number}${item.externalReference ? ` · ${item.externalReference}` : ""}`,
          description: item.status.replaceAll("_", " "),
          href: adminHref(`/admin/compras?id=${item.id}`),
        })),
      },
      {
        title: "Promociones",
        items: (foundPromotions as Array<{
          id: number;
          name: string;
          code: string | null;
          description: string | null;
          status: string;
        }>).map((item) => ({
          id: item.id,
          title: item.name,
          description: `${item.code || ""} · ${item.status.replaceAll("_", " ")}`,
          href: adminHref(`/admin/promociones?id=${item.id}`),
        })),
      },
      {
        title: "Eventos",
        items: (foundEvents as Array<{
          id: number;
          name: string;
          description: string | null;
          date: string | null;
          status: string;
        }>).map((item) => ({
          id: item.id,
          title: item.name,
          description: `${item.description || ""} · ${item.date ? new Date(item.date).toLocaleDateString("es-AR") : ""}`.trim(),
          href: adminHref(`/admin/eventos?id=${item.id}`),
        })),
      },
      {
        title: "Plantillas de documentos",
        items: (foundTemplates as Array<{
          id: number;
          name: string;
          originalFilename: string;
          documentType: string;
          active: boolean;
        }>).map((item) => ({
          id: item.id,
          title: item.name,
          description: `${item.documentType} · ${item.originalFilename} · ${item.active ? "Activa" : "Inactiva"}`,
          href: adminHref(`/admin/configuracion/comprobantes/plantillas?id=${item.id}`),
        })),
      },
    ].filter((group) => group.items.length > 0);

    const total = groups.reduce((sum, group) => sum + group.items.length, 0);

    return (
      <section>
        <PageHeader
          eyebrow="Búsqueda global"
          title="Encontrá lo que necesitás"
          description="Buscá en la carta, los clientes, los pedidos, las reservas y más desde un solo lugar."
          section="busqueda"
        />
        <form className="card mt-6 p-4" action={adminHref("/admin/busqueda")} role="search">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="input"
              name="q"
              defaultValue={query}
              autoFocus
              type="search"
              placeholder="Ej. café, mesa 4, Ana, PED-123…"
            />
            <button className="btn">Buscar</button>
          </div>
        </form>

        {total === 0 ? (
          <div className="card mt-6 p-12 text-center text-[var(--admin-muted)]">
            No se encontraron resultados para “{query}”.
          </div>
        ) : (
          <div className="mt-6 space-y-8">
            {groups.map((group) => (
              <section key={group.title}>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">
                  {group.title} <span className="text-zinc-600">({group.items.length})</span>
                </h2>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((item) => (
                    <Link
                      className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:border-pink-500/40 hover:bg-white/[.06]"
                      href={item.href}
                      key={item.id}
                    >
                      <strong className="block truncate">{item.title}</strong>
                      {item.description && (
                        <span className="mt-0.5 block truncate text-xs text-zinc-500">{item.description}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
        <PageHeader
          eyebrow="Búsqueda global"
          title="Encontrá lo que necesitás"
          description="Buscá en la carta, los clientes, los pedidos, las reservas y más desde un solo lugar."
          section="busqueda"
        />
      <form className="card mt-6 p-4" action={adminHref("/admin/busqueda")} role="search">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="input"
            name="q"
            autoFocus
            type="search"
            placeholder="Ej. café, mesa 4, Ana, PED-123…"
          />
          <button className="btn">Buscar</button>
        </div>
      </form>
      <div className="card mt-6 p-12 text-center text-[var(--admin-muted)]">
        Escribí un término para buscar en todo tu negocio.
      </div>
    </section>
  );
}
