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
  publicGuid?: string;
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
    userUsage?: { allowed: number; used: number };
    licenses: Array<{
      id: number;
      status: string;
      planId: number | null;
      startsAt: string;
      currentPeriodEnd: string | null;
      graceUntil: string | null;
      priceOverride: number | string | null;
      pricePerUser: number | string | null;
      usersAllowed: number;
      notes: string | null;
      plan: { id: number; name: string } | null;
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
        branch.id === branchId
          ? {
              ...branch,
              licenses: branch.licenses.some((item) => item.id === license.id)
                ? branch.licenses.map((item) => (item.id === license.id ? license : item))
                : [license, ...branch.licenses],
            }
          : branch,
      ),
    }));
  }
  /**
   * @summary Elimina una licencia de la vista de cliente de plataforma.
   */
  function removeBranchLicense(branchId: number, licenseId: number) {
    setClient((current) => ({
      ...current,
      branches: current.branches.map((branch) =>
        branch.id === branchId
          ? { ...branch, licenses: branch.licenses.filter((item) => item.id !== licenseId) }
          : branch,
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
            onLicenseRemoved={removeBranchLicense}
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
  onLicenseRemoved,
}: {
  client: ClientDetailData;
  plans: Array<{ id: number; name: string }>;
  selectedBranchId?: number;
  onLicenseUpdated: (
    branchId: number,
    license: ClientDetailData["branches"][number]["licenses"][number],
  ) => void;
  onLicenseRemoved: (branchId: number, licenseId: number) => void;
}) {
  const statusLabels: Record<string, string> = {
    DRAFT: "Borrador",
    TRIAL: "Prueba",
    ACTIVE: "Activa",
    PAYMENT_PENDING: "Pago pendiente",
    GRACE_PERIOD: "Gracia",
    SUSPENDED: "Suspendida",
    CANCELLED: "Cancelada",
  };
  const suspendable = new Set(["ACTIVE", "PAYMENT_PENDING", "TRIAL", "GRACE_PERIOD"]);
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
      usersAllowed: string;
      pricePerUser: string;
    }>({
      title: license ? `Editar licencia de ${branch.name}` : `Asignar licencia a ${branch.name}`,
      html: `<div style="text-align:left">
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Estado</label>
        <select id="branch-license-status" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px">${statusOptions.map((option) => `<option value="${option}" ${license?.status === option ? "selected" : ""}>${option}</option>`).join("")}</select>
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Plan</label>
        <select id="branch-license-plan" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px">${planOptions}</select>
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Vencimiento del período</label>
        <input id="branch-license-period" type="datetime-local" value="${datetime(license?.currentPeriodEnd)}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px" />
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Fin de período de gracia</label>
        <input id="branch-license-grace" type="datetime-local" value="${datetime(license?.graceUntil)}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px" />
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Usuarios permitidos (0 = según plan)</label>
        <input id="branch-license-users" type="number" min="0" value="${license?.usersAllowed ?? 0}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px" />
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Precio por usuario adicional</label>
        <input id="branch-license-per-user" type="number" min="0" step="0.01" value="${license?.pricePerUser ?? ""}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px" />
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
          usersAllowed:
            (document.getElementById("branch-license-users") as HTMLInputElement | null)?.value ?? "0",
          pricePerUser:
            (document.getElementById("branch-license-per-user") as HTMLInputElement | null)?.value ?? "",
        };
      },
    });
    if (!isConfirmed || !values) return;
    try {
      const basePath = `/api/platform/tenants/${client.id}/branch/${branch.id}/license`;
      const editing = license?.id != null;
      const response = await fetch(editing ? `${basePath}/${license.id}` : basePath, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: values.status,
          planId: values.planId ? Number(values.planId) : null,
          currentPeriodEnd: values.currentPeriodEnd ? new Date(values.currentPeriodEnd).toISOString() : null,
          graceUntil: values.graceUntil ? new Date(values.graceUntil).toISOString() : null,
          usersAllowed: Number(values.usersAllowed || 0),
          pricePerUser: values.pricePerUser ? Number(values.pricePerUser) : null,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        license?: ClientDetailData["branches"][number]["licenses"][number];
        error?: string;
      };
      if (!response.ok || !result.license) {
        return Swal.fire({
          title: "No se pudo guardar",
          text: result.error ?? "Revisá los datos e intentá nuevamente.",
          icon: "error",
          confirmButtonColor: "#ec4899",
          background: "#18181b",
          color: "#fafafa",
        });
      }
      onLicenseUpdated(branch.id, result.license);
      await Swal.fire({
        title: "Licencia guardada",
        text: `La licencia de ${branch.name} quedó en ${statusLabels[result.license.status] ?? result.license.status}.`,
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch {
      await Swal.fire({
        title: "No se pudo guardar",
        text: "Ocurrió un error inesperado. Intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }
  /**
   * @summary Suspende o reactiva una licencia de sucursal desde Platform.
   */
  async function setLicenseStatus(branch: ClientDetailData["branches"][number], status: "ACTIVE" | "SUSPENDED") {
    const license = branch.licenses[0];
    if (!license) return;
    const response = await fetch(
      `/api/platform/tenants/${client.id}/branch/${branch.id}/license/${license.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    const result = (await response.json().catch(() => ({}))) as {
      license?: ClientDetailData["branches"][number]["licenses"][number];
      error?: string;
    };
    if (!response.ok || !result.license) {
      return Swal.fire({
        title: "No se pudo actualizar",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    }
    onLicenseUpdated(branch.id, result.license);
  }
  /**
   * @summary Elimina una licencia de sucursal desde Platform.
   */
  async function removeLicense(branch: ClientDetailData["branches"][number]) {
    const license = branch.licenses[0];
    if (!license) return;
    const confirmation = await Swal.fire({
      title: `¿Quitar la licencia de ${branch.name}?`,
      text: "Los usuarios con acceso a esta sucursal quedarán sin cupos operativos hasta asignar una licencia nueva.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await fetch(
      `/api/platform/tenants/${client.id}/branch/${branch.id}/license/${license.id}`,
      { method: "DELETE" },
    );
    if (response.ok) {
      onLicenseRemoved(branch.id, license.id);
      return;
    }
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    await Swal.fire({
      title: "No se pudo quitar",
      text: result.error ?? "Intentá nuevamente.",
      icon: "error",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
  }
  return (
    <Panel title="Licencias por sucursal">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-xs font-black uppercase tracking-wider text-slate-500">
              <th className="px-3 py-3">Sucursal</th>
              <th className="px-3 py-3">Licencia</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Usuarios</th>
              <th className="px-3 py-3">Vencimiento</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {client.branches.map((branch) => {
              const license = branch.licenses[0];
              const usage = branch.userUsage ?? { allowed: 0, used: branch._count.membershipAccess };
              const limitReached = license?.status !== "SUSPENDED" && usage.allowed > 0 && usage.used >= usage.allowed;
              const detailHref =
                client.publicGuid
                  ? `/platform/clientes/${client.publicGuid}/${client.slug}/sucursales/${branch.slug}`
                  : `/platform/clientes/${client.slug}/sucursales/${branch.slug}`;
              return (
                <tr className={selectedBranchId === branch.id ? "bg-amber-300/10" : ""} key={branch.id}>
                  <td className="px-3 py-4">
                    <Link className="font-black hover:text-amber-300" href={detailHref as Route}>
                      {branch.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {branch.active ? "Activa" : "Inactiva"} · {branch.address}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <strong>{license?.plan?.name ?? "Sin plan"}</strong>
                    <p className="text-xs text-slate-500">
                      {license ? `${statusLabels[license.status] ?? license.status}` : "Sin licencia"}
                    </p>
                  </td>
                  <td className="px-3 py-4">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        !license
                          ? "bg-slate-500/15 text-slate-400"
                          : license.status === "ACTIVE" || license.status === "TRIAL"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : license.status === "SUSPENDED" || license.status === "CANCELLED"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-amber-500/15 text-amber-200"
                      }`}
                    >
                      {license ? statusLabels[license.status] ?? license.status : "Sin cupos"}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    <span className="font-black">{usage.used}</span>
                    <span className="text-slate-500"> / {usage.allowed}</span>
                    {limitReached && (
                      <span className="ml-2 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-black uppercase text-rose-300">
                        Sin cupos
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-slate-400">
                    {license?.currentPeriodEnd
                      ? new Date(license.currentPeriodEnd).toLocaleDateString("es-AR")
                      : "—"}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        className="rounded-lg bg-amber-400 px-2.5 py-1.5 text-xs font-black text-slate-950 hover:bg-amber-300"
                        onClick={() => void editLicense(branch)}
                        type="button"
                      >
                        {license ? "Editar" : "Asignar"}
                      </button>
                      {license && suspendable.has(license.status) && (
                        <button
                          className="rounded-lg border border-rose-400/30 px-2.5 py-1.5 text-xs font-black text-rose-300 hover:bg-rose-500/10"
                          onClick={() => void setLicenseStatus(branch, "SUSPENDED")}
                          type="button"
                        >
                          Suspender
                        </button>
                      )}
                      {license?.status === "SUSPENDED" && (
                        <button
                          className="rounded-lg border border-emerald-400/30 px-2.5 py-1.5 text-xs font-black text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => void setLicenseStatus(branch, "ACTIVE")}
                          type="button"
                        >
                          Reactivar
                        </button>
                      )}
                      {license && (
                        <button
                          className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-300"
                          onClick={() => void removeLicense(branch)}
                          type="button"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!client.branches.length && (
        <p className="py-4 text-sm text-slate-400">Este cliente todavía no tiene sucursales.</p>
      )}
    </Panel>
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
