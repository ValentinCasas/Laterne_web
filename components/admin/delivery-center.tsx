"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import { PageHeader, SearchBox, StatusBadge, ActionMenu } from "@/components/admin/ui";
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
  PENDING_ASSIGNMENT: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  ASSIGNED: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30",
  PICKED_UP: "bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-500/30",
  ON_THE_WAY: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  DELIVERED: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  INCIDENT: "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30",
  FAILED: "bg-red-500/15 text-red-300 ring-1 ring-red-500/30",
  CANCELLED: "bg-zinc-500/15 text-zinc-300 ring-1 ring-zinc-500/30",
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

/** @summary Centro de delivery con layout split, scroll independiente y filtros compactos. */
export function DeliveryCenter({ initialDeliveries, branches, drivers, mapProviders }: DeliveryCenterProps) {
  const pathname = usePathname();
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDriver, setFilterDriver] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(false);

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

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of deliveries) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }
    return counts;
  }, [deliveries]);

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

  return (
    <section className="flex h-[calc(100dvh-8rem)] flex-col">
      <PageHeader
        eyebrow="Delivery"
        title="Centro de delivery"
        description="Seguimiento de entregas, repartidores y estado de pedidos."
        section="delivery"
      />

      {!hasMap && (
        <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2 text-xs text-amber-200">
          Configurá un proveedor de mapas para habilitar la vista geográfica.
        </div>
      )}

      {/* Status chips compactos */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilterStatus("")}
          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
            !filterStatus ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
          }`}
        >
          Todos ({deliveries.length})
        </button>
        {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilterStatus(filterStatus === status ? "" : status)}
            className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              filterStatus === status ? statusColor(status) : "text-zinc-400 hover:text-white"
            }`}
          >
            {STATUS_LABELS[status]}{statusCounts[status] ? ` ${statusCounts[status]}` : ""}
          </button>
        ))}
      </div>

      {/* Toolbar compacta */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox value={filterQ} onChange={setFilterQ} placeholder="Buscar por número, pedido o cliente…" className="min-w-[200px] flex-1" />
        <select className="input w-auto text-xs" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} aria-label="Sucursal">
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
          ))}
        </select>
        <select className="input w-auto text-xs" value={filterDriver} onChange={(e) => setFilterDriver(e.target.value)} aria-label="Repartidor">
          <option value="">Todos los repartidores</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={String(driver.id)}>{driver.name}</option>
          ))}
        </select>
      </div>

      {/* Layout split */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        {/* Panel izquierdo: lista de entregas */}
        <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:w-2/5">
          <div className="shrink-0 border-b border-[var(--admin-border)] px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
              Entregas ({visible.length})
            </span>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {visible.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--admin-muted)]">
                Sin entregas para los filtros seleccionados.
              </div>
            ) : (
              <div className="divide-y divide-[var(--admin-border)]/50">
                {visible.map((delivery) => (
                  <button
                    key={delivery.id}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-white/[0.02] ${
                      selected?.id === delivery.id ? "bg-pink-500/[0.06]" : ""
                    }`}
                    onClick={() => {
                      setSelected(delivery);
                      setShowMobileDetail(true);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusColor(delivery.status).split(" ")[0]}`} />
                      <span className="truncate text-sm font-bold text-white">{delivery.customerName}</span>
                      <span className="ml-auto shrink-0 text-xs text-[var(--admin-muted)]">{delivery.number}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--admin-muted)]">
                      <span>{delivery.order?.reference ?? "—"}</span>
                      <span>·</span>
                      <span>{delivery.branch?.name ?? "—"}</span>
                      {delivery.driverProfile && (
                        <>
                          <span>·</span>
                          <span>{delivery.driverProfile.name}</span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panel derecho: detalle */}
        <div className={`hidden flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 lg:block ${
          !selected ? "items-center justify-center" : ""
        }`}>
          {selected ? (
            <DeliveryDetailPanel
              delivery={selected}
              drivers={drivers}
              hasMap={hasMap}
              saving={saving}
              pathname={pathname}
              onAssignDriver={assignDriver}
              onUpdateStatus={updateStatus}
              onReverse={reverseDelivery}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--admin-muted)]">
              Seleccioná una entrega para ver el detalle.
            </div>
          )}
        </div>
      </div>

      {/* Mobile: detalle como overlay */}
      {showMobileDetail && selected && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowMobileDetail(false)} />
          <div className="absolute inset-y-0 right-0 w-full max-w-md overflow-y-auto bg-zinc-950 p-5 shadow-2xl">
            <button
              className="mb-4 text-sm text-zinc-400 hover:text-white"
              onClick={() => setShowMobileDetail(false)}
              type="button"
            >
              ← Volver a la lista
            </button>
            <DeliveryDetailPanel
              delivery={selected}
              drivers={drivers}
              hasMap={hasMap}
              saving={saving}
              pathname={pathname}
              onAssignDriver={assignDriver}
              onUpdateStatus={updateStatus}
              onReverse={reverseDelivery}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** @summary Panel de detalle de una entrega con secciones compactas. */
function DeliveryDetailPanel({
  delivery,
  drivers,
  hasMap,
  saving,
  pathname,
  onAssignDriver,
  onUpdateStatus,
  onReverse,
}: {
  delivery: Delivery;
  drivers: Driver[];
  hasMap: boolean;
  saving: boolean;
  pathname: string;
  onAssignDriver: (deliveryId: number, driverProfileId: number) => void;
  onUpdateStatus: (deliveryId: number, status: DeliveryStatus) => void;
  onReverse: (deliveryId: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Entrega {delivery.number}</h3>
          <p className="text-sm text-[var(--admin-muted)]">{delivery.customerName}</p>
        </div>
        <ActionMenu
          align="right"
          items={[
            { label: "Ver pedido origen", onClick: () => window.open(adminHrefFromPathname(pathname, `/admin/pedidos?id=${delivery.order?.id ?? ""}`), "_blank") },
            { label: "Ver remito", onClick: () => window.open(adminHrefFromPathname(pathname, `/admin/entregas/${delivery.id}`), "_blank") },
            { label: "Anular entrega", tone: "danger", onClick: () => onReverse(delivery.id) },
          ]}
        />
      </div>

      <StatusBadge status={statusLabel(delivery.status)} tone={delivery.status === "DELIVERED" ? "success" : delivery.status === "INCIDENT" || delivery.status === "FAILED" ? "danger" : "warning"} />

      {/* Cliente */}
      <section className="rounded-xl border border-[var(--admin-border)] p-4">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">Cliente</h4>
        <p className="text-sm font-semibold text-white">{delivery.customerName}</p>
        <p className="text-xs text-[var(--admin-muted)]">{delivery.contactPhone}</p>
        <p className="text-xs text-[var(--admin-muted)]">{delivery.deliveryAddress}</p>
      </section>

      {/* Pedido */}
      <section className="rounded-xl border border-[var(--admin-border)] p-4">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">Pedido</h4>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Estado</span><StatusBadge status={orderStatusLabel(delivery.order?.status ?? "—")} tone={delivery.order?.status === "delivered" ? "success" : "info"} /></div>
          <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Referencia</span><strong>{delivery.order?.reference ?? "—"}</strong></div>
          <div className="flex justify-between"><span className="text-[var(--admin-muted)]">Total</span><strong className="tabular-nums">{delivery.order ? String(delivery.order.total) : "—"}</strong></div>
        </dl>
      </section>

      {/* Items */}
      <section className="rounded-xl border border-[var(--admin-border)] p-4">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">Items ({delivery.items?.length ?? 0})</h4>
        <div className="divide-y divide-[var(--admin-border)]/50">
          {(delivery.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-zinc-200">{item.productName}</span>
              <span className="tabular-nums text-[var(--admin-muted)]">x{item.quantityDelivered}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Repartidor */}
      <section className="rounded-xl border border-[var(--admin-border)] p-4">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">Repartidor</h4>
        <select
          className="input w-full text-xs"
          defaultValue={delivery.driverProfile?.id ? String(delivery.driverProfile.id) : ""}
          onChange={(e) => { const val = e.target.value; if (!val) return; onAssignDriver(delivery.id, Number(val)); }}
          aria-label="Asignar repartidor"
        >
          <option value="">Asignar repartidor…</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={String(driver.id)}>{driver.name}</option>
          ))}
        </select>
        {delivery.driverProfile && <p className="mt-1.5 text-sm text-white">{delivery.driverProfile.name}</p>}
      </section>

      {/* Transiciones de estado */}
      <section className="rounded-xl border border-[var(--admin-border)] p-4">
        <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">Cambiar estado</h4>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => {
            const blocked = status === "PICKED_UP" && !canRetireDelivery(delivery.order?.status);
            return (
              <button
                key={status}
                type="button"
                title={blocked ? "El pedido todavía no está listo para retirar" : undefined}
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors ${
                  delivery.status === status ? statusColor(status) : "text-zinc-400 hover:text-white"
                } ${blocked ? "opacity-40" : ""}`}
                onClick={() => onUpdateStatus(delivery.id, status)}
                disabled={saving || blocked}
              >
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
        {awaitingKitchen(delivery.order?.status) && (
          <p className="mt-1.5 text-[10px] text-amber-300">
            Esperando a cocina: el repartidor solo puede retirar cuando el pedido esté listo.
          </p>
        )}
      </section>

      {hasMap && delivery.latitude && delivery.longitude && (
        <section className="rounded-xl border border-[var(--admin-border)] p-4">
          <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--admin-muted)]">Ubicación</h4>
          <p className="text-xs text-[var(--admin-muted)]">Lat: {delivery.latitude} · Lng: {delivery.longitude}</p>
        </section>
      )}
    </div>
  );
}
