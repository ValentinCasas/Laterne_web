import Link from "next/link";

type Tenant = {
  id: number;
  name: string;
  slug: string;
  publicGuid?: string;
  status: string;
  subscription: { status: string; endsAt: string | null; plan: { name: string } | null } | null;
  storageBytes: number;
  branches: Array<{ id: number; name: string }>;
  _count: {
    products: number;
    memberships: number;
    customerOrders: number;
    reservations: number;
    mediaAssets: number;
    errorLogs: number;
  };
  platformPayments: Array<{ amount: string | number; currency: string; paidAt: string }>;
};

/**
 * @summary Renderiza el tablero principal de supervisión de MenuClick.
 */
export function PlatformDashboard({ tenants, newLeads }: { tenants: Tenant[]; newLeads: number }) {
  const pending = tenants.filter((tenant) => tenant.subscription?.status === "PAYMENT_PENDING");
  const trials = tenants.filter((tenant) => tenant.subscription?.status === "TRIAL");
  const suspended = tenants.filter(
    (tenant) => tenant.status !== "active" || tenant.subscription?.status === "SUSPENDED",
  );
  const products = tenants.reduce((sum, tenant) => sum + tenant._count.products, 0);
  const users = tenants.reduce((sum, tenant) => sum + tenant._count.memberships, 0);
  const payments = tenants
    .flatMap((tenant) => tenant.platformPayments)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const cards = [
    [newLeads, "Oportunidades nuevas", "/platform/oportunidades", "text-pink-300"],
    [tenants.length, "Clientes activos", "/platform/clientes", "text-emerald-300"],
    [trials.length, "Trials", "/platform/suscripciones?status=TRIAL", "text-sky-300"],
    [pending.length, "Pagos pendientes", "/platform/pagos?status=pending", "text-amber-300"],
    [suspended.length, "Suspendidos", "/platform/clientes?status=suspended", "text-rose-300"],
  ] as const;
  return (
    <section>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">MenuClick Platform</p>
          <h1 className="mt-2 text-4xl font-black sm:text-6xl">Resumen operativo</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-400">
            Estado comercial, uso y alertas que requieren una decisión. Sin métricas decorativas.
          </p>
        </div>
        <Link
          className="rounded-xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 hover:bg-amber-300"
          href="/platform/clientes/nuevo"
        >
          Alta de cliente
        </Link>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([value, label, href, color]) => (
          <Link
            className="rounded-2xl border border-white/10 bg-[#151a24] p-5 hover:border-amber-300/40"
            href={href}
            key={label}
          >
            <strong className={`block text-4xl font-black ${color}`}>{value}</strong>
            <span className="mt-2 block text-sm text-slate-400">{label}</span>
            <span className="mt-5 block text-xs font-bold text-slate-500">Ver detalle →</span>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-white/10 bg-[#151a24] p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Ingresos registrados
          </span>
          <strong className="mt-3 block text-3xl">$ {payments.toLocaleString("es-AR")}</strong>
          <Link className="mt-3 inline-block text-sm font-bold text-amber-300" href="/platform/pagos">
            Ver pagos
          </Link>
        </article>
        <article className="rounded-2xl border border-white/10 bg-[#151a24] p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Usuarios de negocios
          </span>
          <strong className="mt-3 block text-3xl">{users}</strong>
          <span className="mt-3 block text-sm text-slate-400">Distribuidos en {tenants.length} clientes</span>
        </article>
        <article className="rounded-2xl border border-white/10 bg-[#151a24] p-5">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Productos publicados
          </span>
          <strong className="mt-3 block text-3xl">{products}</strong>
          <Link className="mt-3 inline-block text-sm font-bold text-amber-300" href="/platform/uso">
            Revisar consumo
          </Link>
        </article>
      </div>
      <section className="mt-8 rounded-2xl border border-white/10 bg-[#151a24] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-amber-300">Atención</p>
            <h2 className="mt-1 text-2xl font-black">Vencimientos próximos</h2>
          </div>
          <Link className="text-sm font-bold text-amber-300" href="/platform/suscripciones">
            Todas las suscripciones
          </Link>
        </div>
        <div className="mt-4 divide-y divide-white/10">
          {tenants
            .filter((tenant) => tenant.subscription?.endsAt)
            .slice(0, 5)
            .map((tenant) => (
              <Link
                className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-white/[.03]"
                href={
                  tenant.publicGuid
                    ? `/platform/clientes/${tenant.publicGuid}/${tenant.slug}`
                    : `/platform/clientes/${tenant.id}`
                }
                key={tenant.id}
              >
                <span>
                  <strong>{tenant.name}</strong>
                  <span className="ml-3 text-sm text-slate-400">
                    {tenant.subscription?.plan?.name ?? "Sin plan"}
                  </span>
                </span>
                <time className="text-sm text-amber-200">
                  {new Date(tenant.subscription!.endsAt!).toLocaleDateString("es-AR")}
                </time>
              </Link>
            ))}
          {!tenants.some((tenant) => tenant.subscription?.endsAt) && (
            <p className="py-5 text-sm text-slate-400">No hay vencimientos cargados.</p>
          )}
        </div>
      </section>
    </section>
  );
}
