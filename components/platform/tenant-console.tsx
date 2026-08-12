"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import Swal from "sweetalert2";

export type PlatformTenant = {
  id: number;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  subscription: {
    planId: number | null;
    status: string;
    endsAt: string | null;
    notes: string | null;
    lastPaymentAt: string | null;
    limits: Record<string, unknown> | null;
    enabled: unknown[] | null;
    plan: { name: string } | null;
  } | null;
  brandSettings: { customDomain: string | null } | null;
  platformPayments: Array<{
    amount: string | number;
    currency: string;
    paidAt: string;
    method: string;
    reference: string | null;
  }>;
  storageBytes: number;
  _count: {
    products: number;
    memberships: number;
    customerOrders: number;
    reservations: number;
    mediaAssets: number;
    errorLogs: number;
  };
};
type PlanChoice = { id: number; name: string };

/** @summary Escapa valores administrativos antes de insertarlos en un diálogo HTML. */
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character,
  );
}

/** @summary Recupera un límite numérico desde configuración JSON sin confiar en su forma original. */
function limitValue(tenant: PlatformTenant, key: string) {
  const value = tenant.subscription?.limits?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** @summary Convierte la lista de funciones activadas en un texto editable y seguro. */
function enabledValue(tenant: PlatformTenant) {
  return Array.isArray(tenant.subscription?.enabled)
    ? tenant.subscription.enabled.filter((item): item is string => typeof item === "string").join(", ")
    : "";
}

/** @summary Presenta consumo de almacenamiento con una unidad fácil de comparar. */
function storageValue(bytes: number) {
  if (bytes < 1_000_000) return `${Math.max(0, bytes / 1_000).toFixed(1)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

/** @summary Gestiona altas, suspensiones, planes, vencimientos y pagos manuales de clientes. */
export function TenantConsole({
  initialTenants,
  plans,
}: {
  initialTenants: PlatformTenant[];
  plans: PlanChoice[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  /** @summary Crea un negocio y su usuario propietario desde el panel global. */
  async function createTenant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/platform/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setCreating(false);
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo crear",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  /** @summary Presenta controles sensibles de suscripción y guarda los cambios confirmados. */
  async function manage(tenant: PlatformTenant) {
    const productLimit = limitValue(tenant, "products");
    const userLimit = limitValue(tenant, "users");
    const storageLimit = limitValue(tenant, "storageMb");
    const enabled = enabledValue(tenant);
    const result = await Swal.fire({
      title: tenant.name,
      html: `<label style="display:block;text-align:left">Estado<select id="tenant-status" class="swal2-select" style="display:block;width:100%;margin:.5rem 0"><option value="active" ${tenant.status === "active" ? "selected" : ""}>Activo</option><option value="suspended" ${tenant.status === "suspended" ? "selected" : ""}>Suspendido</option></select></label><label style="display:block;text-align:left">Plan<select id="tenant-plan" class="swal2-select" style="display:block;width:100%;margin:.5rem 0"><option value="">Sin plan</option>${plans.map((plan) => `<option value="${plan.id}" ${tenant.subscription?.planId === plan.id ? "selected" : ""}>${escapeHtml(plan.name)}</option>`).join("")}</select></label><label style="display:block;text-align:left">Dominio personalizado<input id="tenant-domain" class="swal2-input" value="${escapeHtml(tenant.brandSettings?.customDomain ?? "")}" placeholder="menu.negocio.com"></label><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem"><label style="font-size:.75rem">Productos<input id="tenant-products" class="swal2-input" type="number" min="0" value="${productLimit}" style="width:100%;margin:.25rem 0"></label><label style="font-size:.75rem">Usuarios<input id="tenant-users" class="swal2-input" type="number" min="0" value="${userLimit}" style="width:100%;margin:.25rem 0"></label><label style="font-size:.75rem">Almacenamiento MB<input id="tenant-storage" class="swal2-input" type="number" min="0" value="${storageLimit}" style="width:100%;margin:.25rem 0"></label></div><label style="display:block;text-align:left">Funciones activadas<input id="tenant-enabled" class="swal2-input" value="${escapeHtml(enabled)}" placeholder="ar, stock, reservations"></label><label style="display:block;text-align:left">Vencimiento<input id="tenant-end" class="swal2-input" type="datetime-local" value="${tenant.subscription?.endsAt?.slice(0, 16) ?? ""}"></label><textarea id="tenant-notes" class="swal2-textarea" placeholder="Observaciones internas">${escapeHtml(tenant.subscription?.notes ?? "")}</textarea><label style="display:flex;justify-content:center;gap:.5rem"><input id="tenant-payment" type="checkbox"> Registrar pago de hoy</label>`,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      preConfirm: () => ({
        status: (document.querySelector("#tenant-status") as HTMLSelectElement).value,
        planId: Number((document.querySelector("#tenant-plan") as HTMLSelectElement).value) || null,
        endsAt: (document.querySelector("#tenant-end") as HTMLInputElement).value
          ? new Date((document.querySelector("#tenant-end") as HTMLInputElement).value).toISOString()
          : null,
        notes: (document.querySelector("#tenant-notes") as HTMLTextAreaElement).value,
        lastPayment: (document.querySelector("#tenant-payment") as HTMLInputElement).checked,
        customDomain: (document.querySelector("#tenant-domain") as HTMLInputElement).value,
        limits: {
          products: Number((document.querySelector("#tenant-products") as HTMLInputElement).value),
          users: Number((document.querySelector("#tenant-users") as HTMLInputElement).value),
          storageMb: Number((document.querySelector("#tenant-storage") as HTMLInputElement).value),
        },
        enabled: (document.querySelector("#tenant-enabled") as HTMLInputElement).value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await fetch(`/api/platform/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.value),
    });
    if (!response.ok) {
      await Swal.fire({
        title: "No se pudo actualizar",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    router.refresh();
  }

  const totals = initialTenants.reduce(
    (result, tenant) => ({
      products: result.products + tenant._count.products,
      users: result.users + tenant._count.memberships,
      storage: result.storage + tenant.storageBytes,
      errors: result.errors + tenant._count.errorLogs,
    }),
    { products: 0, users: 0, storage: 0, errors: 0 },
  );

  return (
    <section>
      <header className="mb-6 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(245,197,66,.2),transparent_40%),#09090b] p-6 sm:p-9">
        <p className="section-eyebrow">Control global</p>
        <h1 className="mt-2 text-4xl font-black sm:text-6xl">Superadministración</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Clientes, planes, límites, vencimientos, uso y pagos manuales en una vista reservada.
        </p>
        <Link className="btn btn-secondary mt-5" href="/platform/planes">
          Administrar planes y funcionalidades
        </Link>
      </header>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [initialTenants.length, "Clientes"],
          [totals.products, "Productos"],
          [totals.users, "Usuarios"],
          [storageValue(totals.storage), "Almacenamiento"],
          [totals.errors, "Errores técnicos"],
        ].map(([value, label]) => (
          <article className="card p-5" key={label}>
            <strong className="text-3xl">{value}</strong>
            <p className="mt-1 text-sm text-zinc-500">{label}</p>
          </article>
        ))}
      </div>
      <form
        className="card mb-6 grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-6 xl:items-end"
        onSubmit={createTenant}
      >
        <label>
          <span className="label">Negocio</span>
          <input className="input" name="name" required />
        </label>
        <label>
          <span className="label">Slug opcional</span>
          <input className="input" name="slug" />
        </label>
        <label>
          <span className="label">Propietario</span>
          <input className="input" name="ownerName" required />
        </label>
        <label>
          <span className="label">Email</span>
          <input className="input" name="ownerEmail" type="email" required />
        </label>
        <label>
          <span className="label">Contraseña inicial</span>
          <input className="input" name="password" type="password" minLength={10} required />
        </label>
        <div>
          <label>
            <span className="label">Plan</span>
            <select className="input" name="planId">
              <option value="">Sin plan</option>
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn mt-2 w-full" disabled={creating}>
            {creating ? "Creando…" : "Crear cliente"}
          </button>
        </div>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {initialTenants.map((tenant) => (
          <article className="card p-5" key={tenant.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-pink-300">{tenant.slug}</p>
                <h2 className="mt-1 text-2xl font-black">{tenant.name}</h2>
                <p
                  className={`mt-1 text-sm ${tenant.status === "active" ? "text-emerald-300" : "text-red-300"}`}
                >
                  {tenant.status === "active" ? "Activo" : "Suspendido"} ·{" "}
                  {tenant.subscription?.plan?.name ?? "Sin plan"}
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => manage(tenant)} type="button">
                Gestionar
              </button>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
              {[
                [tenant._count.products, "Productos"],
                [tenant._count.memberships, "Usuarios"],
                [tenant._count.customerOrders, "Pedidos"],
                [tenant._count.reservations, "Reservas"],
                [tenant._count.mediaAssets, "Archivos"],
                [tenant._count.errorLogs, "Errores"],
              ].map(([value, label]) => (
                <div className="rounded-xl bg-white/5 p-2" key={label}>
                  <strong className="block text-lg">{value}</strong>
                  <span className="text-[10px] text-zinc-500">{label}</span>
                </div>
              ))}
            </div>
            {tenant.subscription?.endsAt && (
              <p className="mt-4 text-xs text-zinc-500">
                Vence: {new Date(tenant.subscription.endsAt).toLocaleString("es-AR")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              <span>{storageValue(tenant.storageBytes)} almacenados</span>
              {tenant.brandSettings?.customDomain && <span>· {tenant.brandSettings.customDomain}</span>}
              {limitValue(tenant, "products") > 0 && (
                <span>· límite {limitValue(tenant, "products")} productos</span>
              )}
            </div>
            {tenant.platformPayments[0] && (
              <p className="mt-3 text-xs text-emerald-300">
                Último pago: {tenant.platformPayments[0].currency}{" "}
                {Number(tenant.platformPayments[0].amount).toLocaleString("es-AR")} ·{" "}
                {new Date(tenant.platformPayments[0].paidAt).toLocaleDateString("es-AR")}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
