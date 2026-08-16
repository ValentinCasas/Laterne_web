"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Swal from "sweetalert2";

export type ClientDetailData = {
  id: number;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  storageBytes?: number;
  brandSettings: { customDomain: string | null } | null;
  subscription: {
    status: string;
    endsAt: string | null;
    gracePeriodEndsAt: string | null;
    renewalAmount: string | number | null;
    notes: string | null;
    limits: Record<string, unknown> | null;
    enabled: unknown[] | null;
    overrides: unknown;
    plan: {
      name: string;
      features: Array<{ included: boolean; feature: { name: string; key: string } }>;
    } | null;
  } | null;
  branches: Array<{
    id: number;
    name: string;
    slug: string;
    address: string;
    active: boolean;
    isPrimary: boolean;
    licenses: Array<{
      status: string;
      planId: number | null;
      currentPeriodEnd: string | null;
      graceUntil: string | null;
    }>;
    _count: { orders: number; membershipAccess: number; inventoryStocks: number };
  }>;
  memberships: Array<{
    id: number;
    userId: number;
    status: string;
    role: { name: string; key: string };
    user: { name: string; email: string };
    branchAccess: Array<{ branch: { id: number; name: string } }>;
  }>;
  platformPayments: Array<{
    id: number;
    amount: string | number;
    currency: string;
    paidAt: string;
    method: string;
    reference: string | null;
    note: string | null;
  }>;
  auditLogs: Array<{ id: string; action: string; entityType: string; createdAt: string; result: string }>;
  _count: {
    products: number;
    memberships: number;
    customerOrders: number;
    reservations: number;
    mediaAssets: number;
    errorLogs: number;
  };
};

const tabs = [
  "Resumen",
  "Suscripción",
  "Pagos",
  "Sucursales",
  "Usuarios",
  "Límites",
  "Funcionalidades",
  "Dominios",
  "Uso",
  "Auditoría",
] as const;

/**
 * @summary Gestiona el tenant, sus usuarios, sucursales, límites y suscripción.
 */
export function ClientDetail({
  data,
  developmentOnly,
  selectedBranchId,
  plans,
}: {
  data: ClientDetailData;
  developmentOnly: boolean;
  selectedBranchId?: number;
  plans: Array<{ id: number; name: string }>;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Resumen");
  const [client, setClient] = useState(data);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  /**
   * @summary Ejecuta una acción administrativa sobre el tenant y actualiza la vista.
   */
  async function tenantAction(action: "suspend" | "reactivate") {
    const response = await fetch(`/api/platform/tenants/${client.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (response.ok)
      setClient((current) => ({ ...current, status: action === "suspend" ? "suspended" : "active" }));
  }
  /**
   * @summary Elimina un elemento del detalle de cliente de plataforma tras las comprobaciones necesarias.
   */
  async function deleteClient() {
    const confirmation = await Swal.fire({
      title: `¿Eliminar por completo a "${client.name}"?`,
      text: "Se borrará todo su contenido: carta, pedidos, sucursales, usuarios, pagos y auditoría. Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    setDeleting(true);
    const response = await fetch(`/api/platform/tenants/${client.id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/platform/clientes");
      return;
    }
    setDeleting(false);
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    await Swal.fire({
      title: "No se pudo eliminar",
      text: result.error ?? "Intentá nuevamente.",
      icon: "error",
      background: "#18181b",
      color: "#fafafa",
    });
  }
  /**
   * @summary Genera y muestra una contraseña temporal para un usuario del tenant.
   */
  async function assignTemporaryPassword(userId: number) {
    const response = await fetch(`/api/platform/tenants/${client.id}/users/${userId}/temporary-password`, {
      method: "POST",
    });
    const result = (await response.json().catch(() => ({}))) as { temporaryPassword?: string };
    if (response.ok && result.temporaryPassword) setTemporaryPassword(result.temporaryPassword);
  }
  /**
   * @summary Actualiza el estado del detalle de cliente de plataforma y conserva su consistencia.
   */
  function updateBranchLicense(
    branchId: number,
    license: ClientDetailData["branches"][number]["licenses"][number],
  ) {
    setClient((current) => ({
      ...current,
      branches: current.branches.map((branch) =>
        branch.id === branchId ? { ...branch, licenses: [license] } : branch,
      ),
    }));
  }
  return (
    <section>
      <Link className="text-sm font-bold text-amber-300" href="/platform/clientes">
        ← Clientes
      </Link>
      <header className="mt-5 rounded-2xl border border-white/10 bg-[#151a24] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">
              Cliente / ficha completa
            </p>
            <h1 className="mt-2 text-4xl font-black">{client.name}</h1>
            <p className="mt-2 text-slate-400">
              {client.slug} · {client.brandSettings?.customDomain ?? "sin dominio personalizado"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-300"
              onClick={() => void tenantAction(client.status === "active" ? "suspend" : "reactivate")}
              type="button"
            >
              {client.status === "active" ? "Suspender" : "Reactivar"}
            </button>
            <button
              className="rounded-xl border border-rose-400/30 px-3 py-2 text-sm font-bold text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
              disabled={deleting}
              onClick={() => void deleteClient()}
              type="button"
            >
              {deleting ? "Eliminando…" : "Eliminar cliente"}
            </button>
            <Link
              className="rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950"
              href={`/platform/pagos?tenantId=${client.id}`}
            >
              Registrar pago
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Estado" value={client.status === "active" ? "Activo" : "Suspendido"} />
          <Metric label="Plan" value={client.subscription?.plan?.name ?? "Sin plan"} />
          <Metric
            label="Vencimiento"
            value={
              client.subscription?.endsAt
                ? new Date(client.subscription.endsAt).toLocaleDateString("es-AR")
                : "Sin fecha"
            }
          />
          <Metric label="Sucursales" value={String(client.branches.length)} />
          <Metric label="Usuarios" value={String(client._count.memberships)} />
        </div>
      </header>
      <nav
        className="mt-6 flex gap-1 overflow-x-auto border-b border-white/10"
        aria-label="Secciones de cliente"
      >
        {tabs.map((candidate) => (
          <button
            className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-black ${tab === candidate ? "border-amber-300 text-white" : "border-transparent text-slate-400"}`}
            key={candidate}
            onClick={() => setTab(candidate)}
            type="button"
          >
            {candidate}
          </button>
        ))}
      </nav>
      <div className="mt-6">
        {tab === "Resumen" && <Overview client={client} />}
        {tab === "Suscripción" && <Subscription client={client} />}
        {tab === "Pagos" && <Payments client={client} />}
        {tab === "Sucursales" && (
          <Branches
            client={client}
            plans={plans}
            selectedBranchId={selectedBranchId}
            onLicenseUpdated={updateBranchLicense}
          />
        )}
        {tab === "Usuarios" && (
          <Users
            client={client}
            developmentOnly={developmentOnly}
            onTemporaryPassword={assignTemporaryPassword}
          />
        )}
        {tab === "Límites" && <Limits client={client} />}
        {tab === "Funcionalidades" && <Features client={client} />}
        {tab === "Dominios" && <Domains client={client} />}
        {tab === "Uso" && <Overview client={client} />}
        {tab === "Auditoría" && <Audit client={client} />}
      </div>
      {temporaryPassword && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-emerald-300/40 bg-[#151a24] p-6">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-300">Solo desarrollo</p>
            <h2 className="mt-2 text-2xl font-black">Contraseña temporal</h2>
            <p className="mt-2 text-sm text-slate-400">
              Mostrada una sola vez. No se puede recuperar después de cerrar este diálogo.
            </p>
            <code className="mt-5 block rounded-xl bg-[#0b0d12] p-4 text-center text-xl font-black tracking-widest text-white">
              {temporaryPassword}
            </code>
            <div className="mt-5 flex gap-3">
              <button
                className="rounded-xl bg-emerald-400 px-4 py-3 font-black text-slate-950"
                onClick={() => void navigator.clipboard.writeText(temporaryPassword)}
                type="button"
              >
                Copiar
              </button>
              <button
                className="rounded-xl border border-white/10 px-4 py-3 font-bold"
                onClick={() => setTemporaryPassword(null)}
                type="button"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * @summary Renderiza una métrica resumida dentro del panel de plataforma.
 */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[.04] p-3">
      <span className="block text-xs text-slate-500">{label}</span>
      <strong className="mt-1 block truncate text-sm">{value}</strong>
    </div>
  );
}
/**
 * @summary Renderiza el resumen general del cliente de plataforma.
 */
function Overview({ client }: { client: ClientDetailData }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[
        [client._count.products, "Productos"],
        [client._count.customerOrders, "Pedidos"],
        [client._count.reservations, "Reservas"],
        [client._count.mediaAssets, "Archivos"],
        [client._count.errorLogs, "Errores"],
        [client.storageBytes ?? 0, "Almacenamiento"],
      ].map(([value, label]) => (
        <Metric label={String(label)} value={Number(value).toLocaleString("es-AR")} key={String(label)} />
      ))}
    </div>
  );
}
/**
 * @summary Renderiza y permite ajustar la suscripción del cliente.
 */
function Subscription({ client }: { client: ClientDetailData }) {
  const subscription = client.subscription;
  return (
    <Panel title="Suscripción">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Metric label="Estado" value={subscription?.status ?? "Sin suscripción"} />
        <Metric label="Plan" value={subscription?.plan?.name ?? "Sin plan"} />
        <Metric
          label="Vencimiento"
          value={subscription?.endsAt ? new Date(subscription.endsAt).toLocaleString("es-AR") : "Sin fecha"}
        />
        <Metric
          label="Gracia"
          value={
            subscription?.gracePeriodEndsAt
              ? new Date(subscription.gracePeriodEndsAt).toLocaleString("es-AR")
              : "No configurada"
          }
        />
        <Metric
          label="Mensualidad"
          value={
            subscription?.renewalAmount
              ? `$ ${Number(subscription.renewalAmount).toLocaleString("es-AR")}`
              : "No registrada"
          }
        />
      </dl>
      {subscription?.notes && <p className="mt-5 text-sm text-slate-400">{subscription.notes}</p>}
    </Panel>
  );
}
/**
 * @summary Renderiza el historial de pagos del cliente.
 */
function Payments({ client }: { client: ClientDetailData }) {
  return (
    <Panel title="Historial de pagos">
      <div className="divide-y divide-white/10">
        {client.platformPayments.map((payment) => (
          <div className="flex flex-wrap justify-between gap-3 py-4" key={payment.id}>
            <div>
              <strong>
                {payment.currency} {Number(payment.amount).toLocaleString("es-AR")}
              </strong>
              <p className="text-sm text-slate-400">
                {payment.method} · {payment.reference ?? "Sin referencia"}
              </p>
            </div>
            <time className="text-sm text-slate-400">
              {new Date(payment.paidAt).toLocaleDateString("es-AR")}
            </time>
          </div>
        ))}
        {!client.platformPayments.length && <p className="text-slate-400">No hay pagos registrados.</p>}
      </div>
    </Panel>
  );
}
/**
 * @summary Renderiza las sucursales asociadas al cliente.
 */
function Branches({
  client,
  plans,
  selectedBranchId,
  onLicenseUpdated,
}: {
  client: ClientDetailData;
  plans: Array<{ id: number; name: string }>;
  selectedBranchId?: number;
  onLicenseUpdated: (
    branchId: number,
    license: ClientDetailData["branches"][number]["licenses"][number],
  ) => void;
}) {
  /**
   * @summary Actualiza el estado del detalle de cliente de plataforma y conserva su consistencia.
   */
  async function editLicense(branch: ClientDetailData["branches"][number]) {
    const license = branch.licenses[0];
    const statusOptions = [
      "DRAFT",
      "TRIAL",
      "ACTIVE",
      "PAYMENT_PENDING",
      "GRACE_PERIOD",
      "SUSPENDED",
      "CANCELLED",
    ];
    const planOptions = `<option value="">Sin plan</option>${plans.map((plan) => `<option value="${plan.id}" ${license?.planId === plan.id ? "selected" : ""}>${plan.name}</option>`).join("")}`;
    const datetime = (value: string | null | undefined) => value?.slice(0, 16) ?? "";
    const { value: values, isConfirmed } = await Swal.fire<{
      status: string;
      planId: string;
      currentPeriodEnd: string;
      graceUntil: string;
    }>({
      title: `Licencia de ${branch.name}`,
      html: `<div style="text-align:left">
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Estado</label>
        <select id="branch-license-status" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px">${statusOptions.map((option) => `<option value="${option}" ${license?.status === option ? "selected" : ""}>${option}</option>`).join("")}</select>
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Plan</label>
        <select id="branch-license-plan" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px">${planOptions}</select>
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Vencimiento del período</label>
        <input id="branch-license-period" type="datetime-local" value="${datetime(license?.currentPeriodEnd)}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px" />
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Fin de período de gracia</label>
        <input id="branch-license-grace" type="datetime-local" value="${datetime(license?.graceUntil)}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px" />
      </div>`,
      showCancelButton: true,
      confirmButtonText: "Guardar licencia",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
      width: 560,
      focusConfirm: false,
      preConfirm: () => {
        const status =
          (document.getElementById("branch-license-status") as HTMLSelectElement | null)?.value ?? "";
        if (!status) {
          Swal.showValidationMessage("Elegí un estado para la licencia");
          return false;
        }
        return {
          status,
          planId: (document.getElementById("branch-license-plan") as HTMLSelectElement | null)?.value ?? "",
          currentPeriodEnd:
            (document.getElementById("branch-license-period") as HTMLInputElement | null)?.value ?? "",
          graceUntil:
            (document.getElementById("branch-license-grace") as HTMLInputElement | null)?.value ?? "",
        };
      },
    });
    if (!isConfirmed || !values) return;
    try {
      const response = await fetch(`/api/platform/tenants/${client.id}/branch/${branch.id}/license`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: values.status,
          planId: values.planId ? Number(values.planId) : null,
          currentPeriodEnd: values.currentPeriodEnd ? new Date(values.currentPeriodEnd).toISOString() : null,
          graceUntil: values.graceUntil ? new Date(values.graceUntil).toISOString() : null,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        license?: {
          status: string;
          planId: number | null;
          currentPeriodEnd: string | null;
          graceUntil: string | null;
        };
        error?: string;
      };
      if (!response.ok || !result.license) {
        return Swal.fire({
          title: "No se pudo actualizar",
          text: result.error ?? "Revisá los datos e intentá nuevamente.",
          icon: "error",
          confirmButtonColor: "#ec4899",
          background: "#18181b",
          color: "#fafafa",
        });
      }
      onLicenseUpdated(branch.id, result.license);
      await Swal.fire({
        title: "Licencia actualizada",
        text: `La licencia de ${branch.name} quedó en ${result.license.status}.`,
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch {
      await Swal.fire({
        title: "No se pudo actualizar",
        text: "Ocurrió un error inesperado. Intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {client.branches.map((branch) => {
        const license = branch.licenses[0];
        const licenseLabel =
          license?.status === "ACTIVE"
            ? "Licencia activa"
            : license?.status === "DRAFT"
              ? "Licencia borrador"
              : license?.status === "TRIAL"
                ? "Prueba"
                : license?.status === "GRACE_PERIOD"
                  ? "Período de gracia"
                  : license?.status === "PAYMENT_PENDING"
                    ? "Pago pendiente"
                    : license?.status
                      ? `Licencia ${license.status}`
                      : "Sin licencia";
        const detailHref = `/platform/clientes/${client.slug}/sucursales/${branch.slug}`;
        return (
          <article
            className={`relative rounded-2xl border p-5 ${selectedBranchId === branch.id ? "border-amber-300 bg-amber-300/10" : "border-white/10 bg-[#151a24]"}`}
            key={branch.id}
          >
            <Link className="block" href={detailHref as Route}>
              <div className="flex items-start justify-between gap-3 pr-40">
                <div>
                  <h2 className="text-xl font-black hover:text-amber-300">{branch.name}</h2>
                  <span className={`text-sm ${branch.active ? "text-emerald-300" : "text-slate-400"}`}>
                    {branch.active ? "Activa" : "Inactiva"}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-400">{branch.address}</p>
              <p
                className={`mt-3 inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${license?.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300" : license?.status === "SUSPENDED" || license?.status === "CANCELLED" ? "bg-rose-500/15 text-rose-300" : "bg-amber-500/15 text-amber-200"}`}
              >
                {licenseLabel}
              </p>
              {license?.currentPeriodEnd && (
                <p className="mt-2 text-xs text-slate-500">
                  Vence: {new Date(license.currentPeriodEnd).toLocaleDateString("es-AR")}
                </p>
              )}
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                <span>
                  <strong className="block text-lg">{branch._count.membershipAccess}</strong>usuarios
                </span>
                <span>
                  <strong className="block text-lg">{branch._count.orders}</strong>pedidos
                </span>
                <span>
                  <strong className="block text-lg">{branch._count.inventoryStocks}</strong>stocks
                </span>
              </div>
            </Link>
            <button
              className="absolute right-5 top-5 rounded-lg bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 hover:bg-amber-300"
              onClick={() => void editLicense(branch)}
              type="button"
            >
              Administrar licencia
            </button>
          </article>
        );
      })}
    </div>
  );
}
/**
 * @summary Renderiza los usuarios y accesos del cliente.
 */
function Users({
  client,
  developmentOnly,
  onTemporaryPassword,
}: {
  client: ClientDetailData;
  developmentOnly: boolean;
  onTemporaryPassword: (userId: number) => void;
}) {
  return (
    <Panel title="Usuarios del tenant">
      <div className="divide-y divide-white/10">
        {client.memberships.map((membership) => (
          <div className="flex flex-wrap items-center justify-between gap-4 py-4" key={membership.id}>
            <div>
              <strong>{membership.user.name}</strong>
              <p className="text-sm text-slate-400">
                {membership.user.email} · {membership.role.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {membership.branchAccess.length
                  ? membership.branchAccess.map((access) => access.branch.name).join(" · ")
                  : "Sin sucursal asignada"}
              </p>
            </div>
            {developmentOnly && (
              <button
                className="rounded-xl border border-amber-300/30 px-3 py-2 text-xs font-black text-amber-200"
                onClick={() => onTemporaryPassword(membership.userId)}
                type="button"
              >
                Asignar contraseña temporal
              </button>
            )}
          </div>
        ))}
      </div>
      {!developmentOnly && (
        <p className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3 text-xs text-slate-400">
          La asignación temporal está deshabilitada fuera de development.
        </p>
      )}
    </Panel>
  );
}
/**
 * @summary Renderiza el uso y los límites contratados por el cliente.
 */
function Limits({ client }: { client: ClientDetailData }) {
  return (
    <Panel title="Límites configurados">
      <div className="grid gap-3 sm:grid-cols-3">
        {Object.entries(client.subscription?.limits ?? {}).map(([key, value]) => (
          <Metric label={key} value={String(value)} key={key} />
        ))}
      </div>
    </Panel>
  );
}
/**
 * @summary Renderiza las funcionalidades habilitadas para el cliente.
 */
function Features({ client }: { client: ClientDetailData }) {
  return (
    <Panel title="Funcionalidades activadas">
      <div className="grid gap-3 sm:grid-cols-2">
        {client.subscription?.plan?.features.map((feature) => (
          <div
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.03] p-4"
            key={feature.feature.key}
          >
            <span>{feature.feature.name}</span>
            <span className={feature.included ? "text-emerald-300" : "text-slate-500"}>
              {feature.included ? "Incluido por plan" : "No incluido"}
            </span>
          </div>
        ))}
        {(client.subscription?.enabled ?? []).map((feature) => (
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-4" key={String(feature)}>
            <span className="block">{String(feature)}</span>
            <span className="text-xs text-amber-200">Override MenuClick</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
/**
 * @summary Renderiza los dominios configurados para el cliente.
 */
function Domains({ client }: { client: ClientDetailData }) {
  return (
    <Panel title="Dominios">
      <Metric label="Subdominio MenuClick" value={`${client.slug}.app`} />
      <Metric label="Dominio personalizado" value={client.brandSettings?.customDomain ?? "No configurado"} />
    </Panel>
  );
}
/**
 * @summary Renderiza la actividad auditada del cliente.
 */
function Audit({ client }: { client: ClientDetailData }) {
  return (
    <Panel title="Auditoría reciente">
      <div className="divide-y divide-white/10">
        {client.auditLogs.map((log) => (
          <div className="py-3" key={log.id}>
            <strong>{log.action}</strong>
            <span className="ml-3 text-sm text-slate-400">
              {log.entityType} · {new Date(log.createdAt).toLocaleString("es-AR")}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
/**
 * @summary Renderiza una sección visual reutilizable del detalle de plataforma.
 */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-[#151a24] p-5 sm:p-6">
      <h2 className="mb-5 text-2xl font-black">{title}</h2>
      {children}
    </section>
  );
}
