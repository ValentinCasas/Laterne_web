import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

const labels: Record<string, string> = { suscripciones: "Suscripciones", pagos: "Pagos", dominios: "Dominios", uso: "Uso y límites", soporte: "Soporte SaaS", auditoria: "Auditoría global", configuracion: "Configuración MenuClick" };
type PlatformRow = { title: string; detail: string; status?: string; href?: string };

export default async function PlatformSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const section = (await params).section;
  if (!labels[section]) notFound();
  let rows: PlatformRow[] = [];
  if (section === "suscripciones") {
    const tenants = await prisma.tenant.findMany({ include: { subscription: { include: { plan: { select: { name: true } } } } }, orderBy: { updatedAt: "desc" } });
    rows = tenants.map((tenant) => ({ title: tenant.name, detail: `${tenant.subscription?.plan?.name ?? "Sin plan"} · ${tenant.subscription?.endsAt ? new Date(tenant.subscription.endsAt).toLocaleDateString("es-AR") : "sin vencimiento"}`, status: tenant.subscription?.status, href: `/platform/clientes/${tenant.id}` }));
  }
  if (section === "pagos") {
    const payments = await prisma.platformPayment.findMany({ include: { tenant: { select: { name: true } } }, orderBy: { paidAt: "desc" }, take: 300 });
    rows = payments.map((payment) => ({ title: payment.tenant.name, detail: `${payment.currency} ${Number(payment.amount).toLocaleString("es-AR")} · ${payment.method} · ${new Date(payment.paidAt).toLocaleDateString("es-AR")}`, status: payment.reference ?? "Sin referencia", href: `/platform/clientes/${payment.tenantId}` }));
  }
  if (section === "dominios") {
    const tenants = await prisma.tenant.findMany({ include: { brandSettings: { select: { customDomain: true } } }, orderBy: { name: "asc" } });
    rows = tenants.map((tenant) => ({ title: tenant.name, detail: `${tenant.slug}.app · ${tenant.brandSettings?.customDomain ?? "Sin dominio personalizado"}`, status: tenant.brandSettings?.customDomain ? "Configurado" : "Pendiente", href: `/platform/clientes/${tenant.id}` }));
  }
  if (section === "uso") {
    const tenants = await prisma.tenant.findMany({ include: { _count: { select: { products: true, memberships: true, branches: true, customerOrders: true, mediaAssets: true } } }, orderBy: { name: "asc" } });
    rows = tenants.map((tenant) => ({ title: tenant.name, detail: `${tenant._count.products} productos · ${tenant._count.memberships} usuarios · ${tenant._count.branches} sucursales · ${tenant._count.customerOrders} pedidos`, status: `${tenant._count.mediaAssets} archivos`, href: `/platform/clientes/${tenant.id}` }));
  }
  if (section === "soporte") {
    const tickets = await prisma.supportTicket.findMany({ include: { tenant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
    rows = tickets.map((ticket) => ({ title: `${ticket.tenant.name} · ${ticket.subject}`, detail: ticket.message, status: ticket.status, href: `/platform/clientes/${ticket.tenantId}` }));
  }
  if (section === "auditoria") {
    const logs = await prisma.auditLog.findMany({ where: { tenantId: { not: null } }, include: { tenant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 300 });
    rows = logs.map((log) => ({ title: `${log.tenant?.name ?? "Global"} · ${log.action}`, detail: `${log.entityType} · ${new Date(log.createdAt).toLocaleString("es-AR")}`, status: log.result }));
  }
  return <section>
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">MenuClick Platform</p><h1 className="mt-2 text-4xl font-black">{labels[section]}</h1><p className="mt-3 text-slate-400">Supervisión global con datos separados por cliente.</p></div>{section === "configuracion" && <Link className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950" href="/platform/planes">Planes y capacidades</Link>}</header>
    {section === "configuracion" ? <div className="grid gap-4 md:grid-cols-3"><Link className="rounded-2xl border border-white/10 bg-[#151a24] p-5 hover:border-amber-300/40" href="/platform/planes"><strong className="text-xl">Catálogo de planes</strong><p className="mt-2 text-sm text-slate-400">Precios, capacidades y funcionalidades incluidas.</p></Link><Link className="rounded-2xl border border-white/10 bg-[#151a24] p-5 hover:border-amber-300/40" href="/platform/auditoria"><strong className="text-xl">Política de auditoría</strong><p className="mt-2 text-sm text-slate-400">Revisá acciones sensibles de toda la plataforma.</p></Link></div> : <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#151a24]"><div className="hidden grid-cols-[minmax(220px,1fr)_minmax(220px,2fr)_150px] gap-4 border-b border-white/10 px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-500 sm:grid"><span>Cliente / evento</span><span>Detalle</span><span>Estado</span></div>{rows.map((row, index) => <a className="grid gap-2 border-b border-white/10 px-5 py-4 hover:bg-white/[.04] sm:grid-cols-[minmax(220px,1fr)_minmax(220px,2fr)_150px] sm:gap-4" href={row.href} key={`${row.title}-${index}`}><span className="font-black">{row.title}</span><span className="text-sm text-slate-400">{row.detail}</span><span className="text-sm text-amber-200">{row.status ?? "-"}</span></a>)}{!rows.length && <p className="p-12 text-center text-slate-400">No hay registros para mostrar.</p>}</div>}
  </section>;
}
