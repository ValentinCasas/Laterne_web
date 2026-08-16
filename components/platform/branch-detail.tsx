"use client";

import Link from "next/link";
import { useState } from "react";
import Swal from "sweetalert2";

export type BranchDetailData = {
  tenant: { id: number; name: string; slug: string; status: string; publicGuid?: string };
  branch: {
    id: number;
    name: string;
    slug: string;
    address: string;
    city: string | null;
    province: string | null;
    phone: string | null;
    whatsapp: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    deliveryFee: number | string;
    minimumOrder: number | string;
    orderPrefix: string;
    isPrimary: boolean;
    active: boolean;
    inheritLanding: boolean;
    inheritBrand: boolean;
    createdAt: string;
    updatedAt: string;
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
      plan: { id: number; name: string; slug: string } | null;
    }>;
    membershipAccess: Array<{
      id: number;
      membership: {
        id: number;
        status: string;
        user: { name: string; email: string };
        role: { name: string; key: string };
      };
    }>;
    _count: { orders: number; inventoryStocks: number; reservations: number };
    auditLogs: Array<{ id: string; action: string; entityType: string; createdAt: string; result: string }>;
  };
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  TRIAL: "Prueba",
  ACTIVE: "Activa",
  PAYMENT_PENDING: "Pago pendiente",
  GRACE_PERIOD: "Período de gracia",
  SUSPENDED: "Suspendida",
  CANCELLED: "Cancelada",
};

/**
 * @summary Formatea un valor para mostrarlo en el detalle de sucursal de plataforma.
 */
function money(value: number | string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$ ${numeric.toLocaleString("es-AR")}` : String(value);
}

/**
 * @summary Gestiona el estado, la licencia y las métricas de una sucursal de plataforma.
 */
export function BranchDetail({
  data,
  plans,
}: {
  data: BranchDetailData;
  plans: Array<{ id: number; name: string }>;
}) {
  const [branch, setBranch] = useState(data.branch);
  const tenant = data.tenant;
  const license = branch.licenses[0];
  const publicUrl = `/t/${tenant.slug}/s/${branch.slug}`;
  const adminUrl = tenant.publicGuid
    ? `/t/${tenant.publicGuid}/${tenant.slug}/admin/s/${branch.slug}`
    : `/t/${tenant.slug}/admin/s/${branch.slug}`;
  const tenantAdminUrl = tenant.publicGuid
    ? `/t/${tenant.publicGuid}/${tenant.slug}/admin`
    : `/t/${tenant.slug}/admin`;
  const usage = branch.userUsage ?? { allowed: 0, used: branch.membershipAccess.length };
  const limitReached = usage.used >= usage.allowed;

  /**
   * @summary Aplica la selección solicitada en el detalle de sucursal de plataforma.
   */
  async function toggleActive() {
    const nextActive = !branch.active;
    const result = await Swal.fire({
      title: nextActive ? `Reactivar ${branch.name}?` : `Suspender ${branch.name}?`,
      text: nextActive
        ? "La sucursal vuelve a estar operativa para pedidos y administración."
        : "La sucursal queda fuera de operación hasta reactivarla. El resto del negocio no se afecta.",
      icon: nextActive ? "success" : "warning",
      showCancelButton: true,
      confirmButtonText: nextActive ? "Reactivar" : "Suspender",
      cancelButtonText: "Cancelar",
      confirmButtonColor: nextActive ? "#10b981" : "#ef4444",
      background: "#18181b",
      color: "#fafafa",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      const response = await fetch(`/api/platform/tenants/${tenant.id}/branch/${branch.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: nextActive ? "activate" : "suspend" }),
      });
      const body = (await response.json().catch(() => ({}))) as { active?: boolean; error?: string };
      if (!response.ok || body.active === undefined) {
        return Swal.fire({
          title: "No se pudo cambiar el estado",
          text: body.error ?? "Intentá nuevamente.",
          icon: "error",
          confirmButtonColor: "#ec4899",
          background: "#18181b",
          color: "#fafafa",
        });
      }
      setBranch((current) => ({ ...current, active: body.active === true }));
      await Swal.fire({
        title: body.active ? "Sucursal reactivada" : "Sucursal suspendida",
        text: `${branch.name} quedó ${body.active ? "operativa" : "fuera de operación"}.`,
        icon: "success",
        timer: 1400,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } catch {
      await Swal.fire({
        title: "No se pudo cambiar el estado",
        text: "Ocurrió un error inesperado. Intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }

  /**
   * @summary Actualiza el estado del detalle de sucursal de plataforma y conserva su consistencia.
   */
  async function editLicense() {
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
      notes: string;
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
        <input id="branch-license-grace" type="datetime-local" value="${datetime(license?.graceUntil)}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px" />
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Usuarios permitidos (0 = según plan)</label>
        <input id="branch-license-users" type="number" min="0" value="${license?.usersAllowed ?? 0}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px" />
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Precio por usuario adicional</label>
        <input id="branch-license-per-user" type="number" min="0" step="0.01" value="${license?.pricePerUser ?? ""}" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px;margin-bottom:14px" />
        <label style="display:block;font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:6px">Observaciones</label>
        <textarea id="branch-license-notes" style="width:100%;background:#0f1117;color:#fafafa;border:1px solid #3f3f46;border-radius:10px;padding:10px 12px" rows="2">${license?.notes ?? ""}</textarea>
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
          notes: (document.getElementById("branch-license-notes") as HTMLTextAreaElement | null)?.value ?? "",
        };
      },
    });
    if (!isConfirmed || !values) return;
    try {
      const basePath = `/api/platform/tenants/${tenant.id}/branch/${branch.id}/license`;
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
          notes: values.notes || null,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        license?: {
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
      const plan = plans.find((item) => item.id === result.license?.planId) ?? null;
      const saved = {
        ...result.license!,
        plan: plan ? { id: plan.id, name: plan.name, slug: plan.name } : null,
      };
      setBranch((current) => ({
        ...current,
        licenses: editing
          ? current.licenses.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current.licenses],
      }));
      await Swal.fire({
        title: "Licencia guardada",
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
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-10 pt-6">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-400">
        <Link className="font-bold text-amber-300" href="/platform/clientes">
          ← Clientes
        </Link>
        <span>·</span>
        <Link
          className="font-bold text-amber-300"
          href={
            tenant.publicGuid
              ? `/platform/clientes/${tenant.publicGuid}/${tenant.slug}`
              : `/platform/clientes/${tenant.slug}`
          }
        >
          {tenant.name}
        </Link>
        <span>·</span>
        <span className="font-black text-white">{branch.name}</span>
      </nav>

      <header className="mt-4 rounded-2xl border border-white/10 bg-[#151a24] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.25em] text-amber-300">
              Sucursal / ficha de plataforma
            </p>
            <h1 className="mt-2 text-4xl font-black">{branch.name}</h1>
            <p className="mt-2 text-slate-400">
              {tenant.slug} / {branch.slug} · {branch.address}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {branch.isPrimary && (
                <span className="rounded-full bg-pink-500/15 px-2.5 py-1 text-[10px] font-black uppercase text-pink-300">
                  Principal
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${branch.active ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}
              >
                {branch.active ? "Activa" : "Inactiva"}
              </span>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-black uppercase text-amber-200">
                {statusLabels[license?.status ?? ""] ?? license?.status ?? "Sin licencia"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-300"
              onClick={() => void editLicense()}
              type="button"
            >
              Administrar licencia
            </button>
            <button
              className={`rounded-xl px-4 py-2.5 text-sm font-black ${branch.active ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-emerald-500 text-white hover:bg-emerald-400"}`}
              onClick={() => void toggleActive()}
              type="button"
            >
              {branch.active ? "Suspender sucursal" : "Reactivar sucursal"}
            </button>
            <a
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-black text-slate-200 hover:border-amber-300/40"
              href={tenantAdminUrl}
              target="_blank"
              rel="noreferrer"
            >
              Abrir admin del cliente ↗
            </a>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Pedidos" value={String(branch._count.orders)} />
          <Metric label="Reservas" value={String(branch._count.reservations)} />
          <Metric label="Stocks" value={String(branch._count.inventoryStocks)} />
          <Metric label="Usuarios con acceso" value={String(branch.membershipAccess.length)} />
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Licencia">
          {limitReached && (
            <p className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm font-black uppercase text-rose-300">
              Sin cupos disponibles ({usage.used}/{usage.allowed} usuarios)
            </p>
          )}
          <dl className="grid gap-3 sm:grid-cols-2">
            <Metric
              label="Estado"
              value={statusLabels[license?.status ?? ""] ?? license?.status ?? "Sin licencia"}
            />
            <Metric label="Plan" value={license?.plan?.name ?? "Sin plan"} />
            <Metric label="Usuarios" value={`${usage.used}/${usage.allowed}`} />
            <Metric
              label="Inicio"
              value={license?.startsAt ? new Date(license.startsAt).toLocaleDateString("es-AR") : "—"}
            />
            <Metric
              label="Vencimiento del período"
              value={
                license?.currentPeriodEnd ? new Date(license.currentPeriodEnd).toLocaleString("es-AR") : "—"
              }
            />
            <Metric
              label="Fin de gracia"
              value={license?.graceUntil ? new Date(license.graceUntil).toLocaleString("es-AR") : "—"}
            />
            <Metric label="Monto" value={money(license?.priceOverride ?? null)} />
            <Metric label="Precio por usuario" value={money(license?.pricePerUser ?? null)} />
          </dl>
          {license?.notes && (
            <p className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3 text-sm text-slate-400">
              {license.notes}
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            La licencia es por sucursal. Suspenderla no afecta al negocio ni a las otras sucursales.
          </p>
        </Panel>

        <Panel title="Identificación">
          <dl className="grid gap-3 sm:grid-cols-2">
            <Metric label="Slug" value={branch.slug} />
            <Metric label="Dirección" value={branch.address} />
            <Metric label="Ciudad" value={branch.city ?? "—"} />
            <Metric label="Provincia" value={branch.province ?? "—"} />
            <Metric label="Teléfono" value={branch.phone ?? "—"} />
            <Metric label="WhatsApp" value={branch.whatsapp ?? "—"} />
            <Metric label="Prefijo de pedido" value={branch.orderPrefix} />
            <Metric label="Costo de entrega" value={money(branch.deliveryFee)} />
            <Metric label="Pedido mínimo" value={money(branch.minimumOrder)} />
            <Metric
              label="Coordenadas"
              value={branch.latitude && branch.longitude ? `${branch.latitude}, ${branch.longitude}` : "—"}
            />
          </dl>
        </Panel>

        <Panel title="URLs">
          <div className="space-y-3">
            <a
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-slate-300 hover:border-amber-300/40"
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="font-bold">Sitio público</span>
              <span className="truncate text-amber-200">{publicUrl}</span>
            </a>
            <a
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-slate-300 hover:border-amber-300/40"
              href={adminUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="font-bold">Administración</span>
              <span className="truncate text-amber-200">{adminUrl}</span>
            </a>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
            <span>
              <strong className="block text-lg">{branch.inheritLanding ? "Sí" : "No"}</strong>hereda landing
              principal
            </span>
            <span>
              <strong className="block text-lg">{branch.inheritBrand ? "Sí" : "No"}</strong>hereda identidad
              del negocio
            </span>
          </div>
        </Panel>

        <Panel title="Usuarios con acceso">
          <div className="divide-y divide-white/10">
            {branch.membershipAccess.map((access) => (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={access.id}>
                <div>
                  <strong>{access.membership.user.name}</strong>
                  <p className="text-sm text-slate-400">
                    {access.membership.user.email} · {access.membership.role.name}
                  </p>
                </div>
                <span
                  className={`text-xs font-black uppercase ${access.membership.status === "active" ? "text-emerald-300" : "text-rose-300"}`}
                >
                  {access.membership.status}
                </span>
              </div>
            ))}
            {!branch.membershipAccess.length && (
              <p className="py-4 text-sm text-slate-400">No hay usuarios con acceso a esta sucursal.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Auditoría reciente" className="mt-5">
        <div className="divide-y divide-white/10">
          {branch.auditLogs.map((log) => (
            <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={log.id}>
              <div>
                <strong>{log.action}</strong>
                <span className="ml-2 text-sm text-slate-400">{log.entityType}</span>
              </div>
              <div className="flex items-center gap-3">
                <time className="text-sm text-slate-400">
                  {new Date(log.createdAt).toLocaleString("es-AR")}
                </time>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${log.result === "success" ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
                >
                  {log.result}
                </span>
              </div>
            </div>
          ))}
          {!branch.auditLogs.length && (
            <p className="py-4 text-sm text-slate-400">Sin actividad registrada en esta sucursal.</p>
          )}
        </div>
      </Panel>
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
 * @summary Renderiza una sección visual reutilizable del detalle de plataforma.
 */
function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-[#151a24] p-5 sm:p-6 ${className}`}>
      <h2 className="mb-5 text-2xl font-black">{title}</h2>
      {children}
    </section>
  );
}
