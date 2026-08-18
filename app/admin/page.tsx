import type { Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { activeBranchWhere, branchProductWhere } from "@/lib/branch";
import { adminHrefForContext } from "@/lib/routes";

export const dynamic = "force-dynamic";

const statStyles = [
  "from-pink-500/25 to-pink-950/10 text-pink-300",
  "from-amber-500/25 to-amber-950/10 text-amber-300",
  "from-violet-500/25 to-violet-950/10 text-violet-300",
  "from-emerald-500/25 to-emerald-950/10 text-emerald-300",
  "from-sky-500/25 to-sky-950/10 text-sky-300",
] as const;

/** @summary Muestra indicadores, accesos rápidos y actividad reciente del negocio. */
export default async function Dashboard() {
  const context = await requirePermission("admin.access");
  const tenantId = context.tenant.id;
  const activeBranch =
    context.activeBranchId && context.activeBranchId > 0
      ? context.branches.find((branch) => branch.id === context.activeBranchId)
      : undefined;
  const adminHref = (href: string) =>
    adminHrefForContext(context.tenant.slug, href, activeBranch?.slug, context.tenant.publicGuid) as Route;
  const branchFilter = activeBranchWhere(tenantId, context.activeBranchId);
  const productFilter = branchProductWhere(tenantId, context.activeBranchId);
  const [
    products,
    categories,
    events,
    pendingTestimonials,
    newLeads,
    pendingOrders,
    pendingReservations,
    lowStock,
    incompleteProducts,
    recentEvents,
    recentTestimonials,
    users,
    branches,
    files,
    subscription,
  ] = await Promise.all([
    prisma.product.count({ where: productFilter }),
    prisma.category.count({ where: branchFilter }),
    prisma.event.count({ where: branchFilter }),
    prisma.testimonial.count({ where: { ...branchFilter, moderationStatus: "pending" } }),
    context.permissions.includes("lead.manage")
      ? prisma.salesLead.count({ where: { status: "new" } })
      : Promise.resolve(0),
    context.permissions.includes("order.manage")
      ? prisma.customerOrder.count({
          where: {
            ...branchFilter,
            status: { in: ["received", "confirmed", "preparing", "ready"] },
          },
        })
      : Promise.resolve(0),
    context.permissions.includes("reservation.manage")
      ? prisma.reservation.count({ where: { ...branchFilter, status: "pending" } })
      : Promise.resolve(0),
    context.permissions.includes("product.manage")
      ? prisma.inventoryStock.count({
          where: {
            tenantId,
            ...(context.activeBranchId && context.activeBranchId > 0
              ? { branchId: context.activeBranchId }
              : {}),
            tracked: true,
            current: { lte: prisma.inventoryStock.fields.minimum },
          },
        })
      : Promise.resolve(0),
    prisma.product.count({
      where: {
        ...productFilter,
        OR: [{ price: null }, { imageUrl: "product_default.png" }, { categories: { none: {} } }],
      },
    }),
    prisma.event.findMany({
      where: branchFilter,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 3,
    }),
    prisma.testimonial.findMany({ where: branchFilter, orderBy: { id: "desc" }, take: 3 }),
    prisma.tenantMembership.count({ where: { tenantId, status: "active" } }),
    prisma.branch.count({ where: { tenantId, active: true } }),
    prisma.mediaAsset.aggregate({ where: { tenantId }, _sum: { sizeBytes: true } }),
    prisma.tenantSubscription.findUnique({ where: { tenantId }, select: { status: true, endsAt: true } }),
  ]);

  const stats = [
    { label: "Productos publicados", value: products, href: "/admin/productos" },
    { label: "Categorías activas", value: categories, href: "/admin/categorias" },
    { label: "Eventos cargados", value: events, href: "/admin/eventos" },
    { label: "Opiniones pendientes", value: pendingTestimonials, href: "/admin/testimonios" },
  ] as const;
  const visibleStats = context.permissions.includes("lead.manage")
    ? [...stats, { label: "Oportunidades nuevas", value: newLeads, href: "/admin/oportunidades" } as const]
    : stats;
  const overviewStats = [
    ...visibleStats,
    { label: "Usuarios activos", value: users, href: "/admin/usuarios" },
    { label: "Sucursales activas", value: branches, href: "/admin/sucursales" },
    {
      label: "Almacenamiento",
      value: `${(Number(files._sum.sizeBytes ?? 0) / 1_000_000).toFixed(1)} MB`,
      href: "/admin/archivos",
    },
  ];
  const operationAlerts = [
    context.permissions.includes("order.manage") && {
      label: "Pedidos en curso",
      value: pendingOrders,
      href: "/admin/pedidos",
    },
    context.permissions.includes("reservation.manage") && {
      label: "Reservas pendientes",
      value: pendingReservations,
      href: "/admin/reservas",
    },
    context.permissions.includes("product.manage") && {
      label: "Alertas de stock",
      value: lowStock,
      href: "/admin/inventario",
    },
    context.permissions.includes("product.manage") && {
      label: "Productos incompletos",
      value: incompleteProducts,
      href: "/admin/productos",
    },
  ].filter(Boolean) as { label: string; value: number; href: string }[];

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Centro de control"
        title="Tu negocio, en un solo lugar."
        description="Actualizá la carta, publicá eventos y moderá opiniones sin tocar código."
        section="resumen"
        actions={
          <>
            <Link className="btn" href={adminHref("/admin/productos")}>
              Agregar producto
            </Link>
            <Link className="btn btn-secondary" href={adminHref("/admin/eventos")}>
              Nuevo evento
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((stat, index) => (
          <Link
            className={`group rounded-3xl border border-white/10 bg-gradient-to-br p-5 transition hover:-translate-y-1 hover:border-white/20 ${statStyles[index]}`}
            href={adminHref(stat.href)}
            key={stat.label}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="max-w-32 text-sm font-bold text-zinc-300">{stat.label}</p>
              <span className="text-lg transition group-hover:translate-x-1">→</span>
            </div>
            <strong className="mt-8 block text-5xl font-black text-white">{stat.value}</strong>
          </Link>
        ))}
      </div>

      {operationAlerts.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-300">
                Atención operativa
              </p>
              <h2 className="mt-1 text-2xl font-black">Qué conviene revisar ahora</h2>
            </div>
            <Link className="text-sm font-bold text-pink-300" href={adminHref("/admin/notificaciones")}>
              Centro de actividad
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {operationAlerts.map((alert) => (
              <Link
                className="rounded-2xl bg-white/[.04] p-4 transition hover:bg-white/[.07]"
                href={adminHref(alert.href)}
                key={alert.label}
              >
                <strong className="text-3xl">{alert.value}</strong>
                <p className="mt-1 text-sm text-zinc-400">{alert.label}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
      {subscription && subscription.status !== "ACTIVE" && (
        <Link
          className="block rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-100"
          href={adminHref("/admin/soporte")}
        >
          <strong>Estado de suscripción: {subscription.status}</strong>
          <span className="ml-2 text-sm text-amber-200">Revisá la información de tu cuenta.</span>
        </Link>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-violet-300">Agenda</p>
              <h2 className="mt-1 text-2xl font-black">Eventos recientes</h2>
            </div>
            <Link
              className="text-sm font-bold text-pink-300 hover:text-pink-200"
              href={adminHref("/admin/eventos")}
            >
              Ver todos
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {recentEvents.map((event) => (
              <article className="flex items-center gap-4 rounded-2xl bg-white/[.04] p-4" key={event.id}>
                <time className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-xs font-black text-violet-300">
                  {event.date?.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) ?? "S/F"}
                </time>
                <div className="min-w-0">
                  <h3 className="truncate font-black">{event.name}</h3>
                  <p className="truncate text-sm text-zinc-500">{event.location}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Comunidad</p>
              <h2 className="mt-1 text-2xl font-black">Últimas opiniones</h2>
            </div>
            <Link
              className="text-sm font-bold text-pink-300 hover:text-pink-200"
              href={adminHref("/admin/testimonios")}
            >
              Moderar
            </Link>
          </div>
          <div className="mt-5 space-y-3">
            {recentTestimonials.map((testimonial) => (
              <article className="rounded-2xl bg-white/[.04] p-4" key={testimonial.id}>
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                      testimonial.moderationStatus === "approved"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : testimonial.moderationStatus === "rejected"
                          ? "bg-red-500/15 text-red-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {testimonial.moderationStatus === "approved"
                      ? "Publicada"
                      : testimonial.moderationStatus === "rejected"
                        ? "Rechazada"
                        : "Pendiente"}
                  </span>
                  <time className="text-xs text-zinc-600">
                    {testimonial.date.toLocaleDateString("es-AR")}
                  </time>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-300">
                  “{testimonial.description}”
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
