"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, StatusBadge, DocumentHeader, DocumentLines, FactBox, SplitView, SectionHeader, ActionMenu, EmptyState } from "@/components/admin/ui";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { canRetireDelivery } from "@/lib/delivery-drivers";
import { orderStatusLabel } from "@/lib/orders";
import { normalizeDeliveryDetail, type DeliveryDetail } from "@/lib/delivery-detail";

type Delivery = DeliveryDetail;

type Branch = { id: number; name: string; slug: string };
type Driver = { id: number; name: string; phone?: string; status?: string };

type DeliveryCenterProps = {
  initialDeliveries: Delivery[];
  branches: Branch[];
  drivers: Driver[];
  mapProviders: Array<{ provider: string }>;
};

type DeliveryStatus =
  | "PENDING_ASSIGNMENT"
  | "ASSIGNED"
  | "PICKED_UP"
  | "ON_THE_WAY"
  | "DELIVERED"
  | "INCIDENT"
  | "FAILED"
  | "CANCELLED";

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  PENDING_ASSIGNMENT: "Sin asignar",
  ASSIGNED: "Asignado",
  PICKED_UP: "Retirado",
  ON_THE_WAY: "En camino",
  DELIVERED: "Entregado",
  INCIDENT: "Incidencia",
  FAILED: "Fallido",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_ASSIGNMENT: "bg-amber-500/15 text-amber-300",
  ASSIGNED: "bg-sky-500/15 text-sky-300",
  PICKED_UP: "bg-indigo-500/15 text-indigo-300",
  ON_THE_WAY: "bg-violet-500/15 text-violet-300",
  DELIVERED: "bg-emerald-500/15 text-emerald-300",
  INCIDENT: "bg-orange-500/15 text-orange-300",
  FAILED: "bg-red-500/15 text-red-300",
  CANCELLED: "bg-zinc-500/15 text-zinc-300",
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-zinc-500/15 text-zinc-300";
}

function statusLabel(status: string) {
  return STATUS_LABELS[status as DeliveryStatus] ?? status;
}

/** @summary Centros de preparación que todavía no habilitan el retiro. */
function awaitingKitchen(orderStatus: string | null | undefined) {
  return ["received", "confirmed", "preparing"].includes(orderStatus ?? "");
}

/** @summary Centro de delivery con lista, panel de detalle y filtros compactos. */
export function DeliveryCenter({ initialDeliveries, branches, drivers, mapProviders }: DeliveryCenterProps) {
  const pathname = usePathname();
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDriver, setFilterDriver] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);

  const hasMap = mapProviders.length > 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      void (async () => {
        if (saving) return;
        const response = await scopedFetch("/api/admin/delivery?limit=200").catch(() => null);
        if (!response || !response.ok) return;
        const body = (await response.json().catch(() => null)) as { items?: Delivery[] } | null;
        if (!body?.items) return;
        const fresh = body.items.map(normalizeDeliveryDetail);
        setDeliveries(fresh);
        setSelected((current) => {
          if (!current) return current;
          const match = fresh.find((item) => item.id === current.id);
          return match ? { ...match, items: match.items ?? [] } : current;
        });
      })();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [saving]);

  const visible = useMemo(() => {
    const q = filterQ.trim().toLocaleLowerCase("es");
    return deliveries.filter((d) => {
      if (filterStatus && d.status !== filterStatus) return false;
      if (filterBranch && d.branch?.id !== Number(filterBranch)) return false;
      if (filterDriver && d.driverProfile?.id !== Number(filterDriver)) return false;
      if (!q) return true;
      return [d.number, d.customerName, d.order?.reference, d.externalOrderId, d.deliveryAddress]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase("es").includes(q));
    });
  }, [deliveries, filterStatus, filterBranch, filterDriver, filterQ]);

  async function assignDriver(deliveryId: number, driverProfileId: number) {
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ASSIGNED", driverProfileId }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: Delivery; error?: string };
      const delivery = body.delivery ? normalizeDeliveryDetail(body.delivery) : undefined;
      if (!response.ok || !delivery) {
        await Swal.fire({ title: "No se pudo asignar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? delivery : d)));
      setSelected((current) => (current?.id === deliveryId ? delivery : current));
      await Swal.fire({ title: "Repartidor asignado", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(deliveryId: number, status: DeliveryStatus) {
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: Delivery; error?: string };
      const delivery = body.delivery ? normalizeDeliveryDetail(body.delivery) : undefined;
      if (!response.ok || !delivery) {
        await Swal.fire({ title: "No se pudo actualizar", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? delivery : d)));
      setSelected((current) => (current?.id === deliveryId ? delivery : current));
    } finally {
      setSaving(false);
    }
  }

  async function reverseDelivery(deliveryId: number) {
    const confirmed = await Swal.fire({
      title: "¿Anular entrega?",
      text: "Se revertirán las cantidades al pedido original.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Anular",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmed.isConfirmed) return;
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/deliveries/${deliveryId}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Anulación manual desde el panel" }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: Delivery; error?: string };
      const delivery = body.delivery ? normalizeDeliveryDetail(body.delivery) : undefined;
      if (!response.ok || !delivery) {
        await Swal.fire({ title: "No se pudo anular", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? delivery : d)));
      setSelected((current) => (current?.id === deliveryId ? delivery : current));
      await Swal.fire({ title: "Entrega anulada", text: "Las cantidades volvieron al pedido.", icon: "success", timer: 1500, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
    } finally {
      setSaving(false);
    }
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of deliveries) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }
    return counts;
  }, [deliveries]);

  return (
    <section className="space-y-4">
      <PageHeader eyebrow="Delivery" title="Centro de delivery" description="Seguimiento de entregas, repartidores y estado de pedidos." section="delivery" />
      {!hasMap && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-200">
          Configurá un proveedor de mapas para habilitar la vista geográfica. La lista de entregas sigue funcionando sin mapa.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={filterQ} onChange={setFilterQ} placeholder="Buscar por número, pedido o cliente…" className="min-w-[220px] flex-1" />
        <select className="input w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select className="input w-auto" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} aria-label="Filtrar por sucursal">
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
          ))}
        </select>
        <select className="input w-auto" value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} aria-label="Filtrar por repartidor">
          <option value="">Todos los repartidores</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={String(driver.id)}>{driver.name}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(filterStatus === status ? "" : status)}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
              filterStatus === status ? statusColor(status) : "border border-white/10 bg-white/5 text-zinc-400 hover:text-white"
            }`}
          >
            {STATUS_LABELS[status]} {statusCounts[status] ? `(${statusCounts[status]})` : ""}
          </button>
        ))}
      </div>

      <SplitView
        primary={
          <div className="space-y-2">
            {visible.length === 0 && (
              <EmptyState title="Sin entregas" description="No hay entregas registradas para los filtros seleccionados." />
            )}
            {visible.map((delivery) => (
              <button
                key={delivery.id}
                className={`w-full rounded-2xl border p-4 text-left transition hover:bg-white/[.03] ${selected?.id === delivery.id ? "border-pink-500/40 bg-pink-500/[.04]" : "border-white/10 bg-white/[.02]"}`}
                onClick={() => setSelected(delivery)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={statusLabel(delivery.status)} tone={delivery.status === "DELIVERED" ? "success" : delivery.status === "INCIDENT" || delivery.status === "FAILED" ? "danger" : "warning"} />
                  <span className="text-xs text-[var(--admin-muted)]">{delivery.number}</span>
                  <span className="text-xs text-[var(--admin-muted)]">{delivery.provider}</span>
                </div>
                <p className="mt-1 text-sm font-bold text-white">{delivery.customerName}</p>
                <p className="text-xs text-[var(--admin-muted)]">{delivery.order?.reference ?? "—"} · {delivery.branch?.name ?? "—"}</p>
                {delivery.driverProfile && <p className="text-xs text-[var(--admin-muted)]">Repartidor: {delivery.driverProfile.name}</p>}
              </button>
            ))}
          </div>
        }
        sidebar={
          selected ? (
            <div className="space-y-4">
              <DocumentHeader
                reference={`Entrega ${selected.number}`}
                title={selected.customerName}
                status={<StatusBadge status={statusLabel(selected.status)} tone={selected.status === "DELIVERED" ? "success" : selected.status === "INCIDENT" || selected.status === "FAILED" ? "danger" : "warning"} />}
                actions={
                  <ActionMenu
                    align="right"
                    items={[
                      { label: "Ver pedido origen", onClick: () => window.open(adminHrefFromPathname(pathname, `/admin/pedidos?id=${selected.order?.id ?? ""}`), "_blank") },
                      {
                        label: "Ver remito",
                        onClick: () => window.open(adminHrefFromPathname(pathname, `/admin/entregas/${selected.id}`), "_blank"),
                      },
                      { label: "Anular entrega", tone: "danger", onClick: () => reverseDelivery(selected.id) },
                    ]}
                  />
                }
              />

              <FactBox title="Cliente">
                <p className="text-sm font-semibold text-white">{selected.customerName}</p>
                <p className="text-xs text-zinc-500">{selected.contactPhone}</p>
                <p className="text-xs text-zinc-500">{selected.deliveryAddress}</p>
              </FactBox>

              <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <SectionHeader title="Pedido" description={`Referencia ${selected.order?.reference ?? "—"}`} />
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-500">Estado</span><StatusBadge status={orderStatusLabel(selected.order?.status ?? "—")} tone={selected.order?.status === "delivered" ? "success" : "info"} /></div>
                  <div className="flex justify-between"><span className="text-zinc-500">Modalidad</span><strong>{selected.order?.orderType ?? "—"}</strong></div>
                  {selected.order?.channel && <div className="flex justify-between"><span className="text-zinc-500">Canal</span><strong>{selected.order.channel}</strong></div>}
                  <div className="flex justify-between"><span className="text-zinc-500">Total</span><strong className="tabular-nums">{selected.order ? String(selected.order.total) : "—"}</strong></div>
                </dl>
              </section>

              <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <SectionHeader title="Items entregados" description={`${selected.items?.length ?? 0} productos`} />
                <div className="mt-3">
                  <DocumentLines headers={["Producto", "Cantidad"]}>
                    {(selected.items ?? []).map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-sm text-zinc-200">{item.productName}</td>
                        <td className="px-4 py-2 text-sm text-right tabular-nums text-zinc-400">x{item.quantityDelivered}</td>
                      </tr>
                    ))}
                  </DocumentLines>
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <SectionHeader title="Repartidor" description="Asignación y estado" />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select
                    className="input w-auto"
                    defaultValue={selected.driverProfile?.id ? String(selected.driverProfile.id) : ""}
                    onChange={(e) => { const val = e.target.value; if (!val) return; assignDriver(selected.id, Number(val)); }}
                    aria-label="Asignar repartidor"
                  >
                    <option value="">Asignar repartidor…</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={String(driver.id)}>{driver.name}</option>
                    ))}
                  </select>
                  {selected.driverProfile && <span className="text-sm text-white">{selected.driverProfile.name}</span>}
                </div>
              </section>

              <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <SectionHeader title="Estado" description="Transiciones válidas" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => {
                    const blocked = status === "PICKED_UP" && !canRetireDelivery(selected.order?.status);
                    return (
                      <button
                        key={status}
                        type="button"
                        title={blocked ? "El pedido todavía no está listo para retirar" : undefined}
                        className={`btn btn-secondary text-xs ${selected.status === status ? "btn-primary" : ""} ${blocked ? "opacity-40" : ""}`}
                        onClick={() => updateStatus(selected.id, status)}
                        disabled={saving || blocked}
                      >
                        {STATUS_LABELS[status]}
                      </button>
                    );
                  })}
                </div>
                {awaitingKitchen(selected.order?.status) && (
                  <p className="mt-2 text-xs text-amber-300">
                    Esperando a cocina: el repartidor solo puede retirar cuando el pedido esté listo.
                  </p>
                )}
              </section>

              {hasMap && selected.latitude && selected.longitude && (
                <section className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                  <SectionHeader title="Ubicación" description="Coordenadas registradas" />
                  <p className="mt-2 text-sm text-zinc-300">Lat: {selected.latitude} · Lng: {selected.longitude}</p>
                </section>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-[var(--admin-muted)]">
              Seleccioná una entrega para ver el detalle.
            </div>
          )
        }
      />
    </section>
  );
}
