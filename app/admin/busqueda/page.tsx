import type { Route } from "next";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { requirePermission } from "@/lib/auth";
import { branchProductWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";
import { adminHrefForContext } from "@/lib/routes";

export const dynamic = "force-dynamic";

type SearchPageProps = { searchParams: Promise<{ q?: string }> };

/** @summary Busca de forma consolidada en la carta, clientes, pedidos y reservas del negocio. */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const context = await requirePermission("admin.access");
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const adminHref = (href: string) =>
    adminHrefForContext(context.tenant.slug, href, context.activeBranchId != null && context.activeBranchId > 0
      ? context.branches.find((branch) => branch.id === context.activeBranchId)?.slug
      : undefined) as Route;

  let products: Array<{ id: number; name: string; price: string | null; status: string }> = [];
  let categories: Array<{ id: number; name: string }> = [];
  let customers: Array<{ id: number; name: string; email: string | null; phone: string | null; points: number }> = [];
  let orders: Array<{ id: number; reference: string; customerName: string; status: string; orderType: string }> = [];
  let reservations: Array<{ id: number; reference: string; customerName: string; status: string }> = [];

  if (query) {
    const contains = { contains: query, mode: "insensitive" as const };
    const tenantId = context.tenant.id;
    const [foundProducts, foundCategories, foundCustomers, foundOrders, foundReservations] =
      await Promise.all([
        context.permissions.includes("product.manage")
          ? prisma.product.findMany({
              where: { ...branchProductWhere(tenantId, context.activeBranchId), name: contains },
              select: { id: true, name: true, price: true, status: true },
              take: 12,
            }).then((items) => items.map((item) => ({ id: item.id, name: item.name, price: item.price === null ? null : item.price.toString(), status: item.status })))
          : Promise.resolve([]),
        context.permissions.includes("product.manage")
          ? prisma.category.findMany({ where: { tenantId, name: contains }, select: { id: true, name: true }, take: 8 })
          : Promise.resolve([]),
        context.permissions.includes("customer.manage")
          ? prisma.loyaltyCustomer.findMany({
              where: { tenantId, OR: [{ name: contains }, { email: contains }, { phone: contains }] },
              select: { id: true, name: true, email: true, phone: true, points: true },
              take: 12,
            })
          : Promise.resolve([]),
        context.permissions.includes("order.manage")
          ? prisma.customerOrder.findMany({
              where: { tenantId, OR: [{ reference: contains }, { customerName: contains }] },
              select: { id: true, reference: true, customerName: true, status: true, orderType: true },
              take: 12,
            })
          : Promise.resolve([]),
        context.permissions.includes("reservation.manage")
          ? prisma.reservation.findMany({
              where: { tenantId, OR: [{ reference: contains }, { customerName: contains }] },
              select: { id: true, reference: true, customerName: true, status: true },
              take: 8,
            })
          : Promise.resolve([]),
      ]);
    products = foundProducts;
    categories = foundCategories;
    customers = foundCustomers;
    orders = foundOrders;
    reservations = foundReservations;
  }

  const total = products.length + categories.length + customers.length + orders.length + reservations.length;

  return (
    <section>
      <AdminPageHeader
        eyebrow="Búsqueda global"
        title="Encontrá lo que necesitás"
        description="Buscá en la carta, los clientes, los pedidos y las reservas desde un solo lugar."
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

      {!query ? (
        <div className="card mt-6 p-12 text-center text-[var(--admin-muted)]">
          Escribí un término para buscar en todo tu negocio.
        </div>
      ) : total === 0 ? (
        <div className="card mt-6 p-12 text-center text-[var(--admin-muted)]">
          No se encontraron resultados para “{query}”.
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {[
            {
              title: "Productos",
              items: products,
              href: (item: { id: number }) => `/admin/productos?id=${item.id}`,
              render: (item: (typeof products)[number]) => (
                <>
                  <strong className="block truncate">{item.name}</strong>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {item.price ? `$${Number(item.price).toLocaleString("es-AR")}` : "Sin precio"} · {item.status}
                  </span>
                </>
              ),
            },
            {
              title: "Categorías",
              items: categories,
              href: (item: { id: number }) => `/admin/categorias?id=${item.id}`,
              render: (item: (typeof categories)[number]) => (
                <strong className="block truncate">{item.name}</strong>
              ),
            },
            {
              title: "Clientes frecuentes",
              items: customers,
              href: (item: { id: number }) => `/admin/clientes-frecuentes?id=${item.id}`,
              render: (item: (typeof customers)[number]) => (
                <>
                  <strong className="block truncate">{item.name}</strong>
                  <span className="mt-0.5 block truncate text-xs text-zinc-500">
                    {item.email || item.phone || "Sin contacto"} · {item.points} puntos
                  </span>
                </>
              ),
            },
            {
              title: "Pedidos",
              items: orders,
              href: (item: { id: number }) => `/admin/pedidos?id=${item.id}`,
              render: (item: (typeof orders)[number]) => (
                <>
                  <strong className="block truncate">
                    {item.reference} · {item.customerName}
                  </strong>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {item.orderType.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}
                  </span>
                </>
              ),
            },
            {
              title: "Reservas",
              items: reservations,
              href: (item: { id: number }) => `/admin/reservas?id=${item.id}`,
              render: (item: (typeof reservations)[number]) => (
                <>
                  <strong className="block truncate">
                    {item.reference} · {item.customerName}
                  </strong>
                  <span className="mt-0.5 block text-xs text-zinc-500">{item.status.replaceAll("_", " ")}</span>
                </>
              ),
            },
          ].map(
            (group) =>
              group.items.length > 0 && (
                <section key={group.title}>
                  <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[var(--admin-muted)]">
                    {group.title} <span className="text-zinc-600">({group.items.length})</span>
                  </h2>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {group.items.map((item) => (
                      <Link
                        className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:border-pink-500/40 hover:bg-white/[.06]"
                        href={adminHref(group.href(item))}
                        key={item.id}
                      >
                        {group.render(item as never)}
                      </Link>
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </section>
  );
}