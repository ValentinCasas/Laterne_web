"use client";

import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
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

const ORDER_STATUS_COLORS: Record<string, string> = {
  received: "bg-sky-500/15 text-sky-300",
  confirmed: "bg-indigo-500/15 text-indigo-300",
  preparing: "bg-amber-500/15 text-amber-300",
  ready: "bg-pink-500/15 text-pink-300",
  on_the_way: "bg-violet-500/15 text-violet-300",
  delivered: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-red-500/15 text-red-300",
};

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-zinc-500/15 text-zinc-300";
}

function statusLabel(status: string) {
  return STATUS_LABELS[status as DeliveryStatus] ?? status;
}

function orderStatusColor(status: string) {
  return ORDER_STATUS_COLORS[status] ?? "bg-zinc-500/15 text-zinc-300";
}

/** @summary Centros de preparación que todavía no habilitan el retiro. */
function awaitingKitchen(orderStatus: string | null | undefined) {
  return ["received", "confirmed", "preparing"].includes(orderStatus ?? "");
}

/** @summary Centro de delivery con lista, mapa abstracto y detalle de entregas. */
export function DeliveryCenter({ initialDeliveries, branches, drivers, mapProviders }: DeliveryCenterProps) {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDriver, setFilterDriver] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [selected, setSelected] = useState<Delivery | null>(null);
  const [saving, setSaving] = useState(false);

  const hasMap = mapProviders.length > 0;

  // Polling ligero (sin WebSockets): refleja los avances del repartidor y de
  // cocina en el centro de delivery usando el endpoint de lista existente.
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

  return (
    <section>
      <AdminPageHeader eyebrow="Delivery" title="Centro de delivery" description="Seguimiento de entregas, repartidores y estado de pedidos." section="delivery" />
      {!hasMap && (
        <div className="card mt-4 border border-amber-500/20 bg-amber-500/[0.04] p-4 text-sm text-amber-200">
          Configurá un proveedor de mapas para habilitar la vista geográfica. La lista de entregas sigue funcionando sin mapa.
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
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
        <input className="input max-w-xs flex-1" placeholder="Buscar por número, pedido o cliente…" value={filterQ} onChange={(e) => setFilterQ(e.target.value)} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {visible.length === 0 && <p className="p-6 text-center text-[var(--admin-muted)]">Sin entregas.</p>}
          {visible.map((delivery) => (
            <button
              key={delivery.id}
              className={`w-full rounded-2xl border p-4 text-left transition hover:bg-white/[.03] ${selected?.id === delivery.id ? "border-pink-500/40 bg-pink-500/[.04]" : "border-white/10 bg-white/[.02]"}`}
              onClick={() => setSelected(delivery)}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusColor(delivery.status)}`}>{statusLabel(delivery.status)}</span>
                <span className="text-xs text-[var(--admin-muted)]">{delivery.number}</span>
                <span className="text-xs text-[var(--admin-muted)]">{delivery.provider}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-white">{delivery.customerName}</p>
              <p className="text-xs text-[var(--admin-muted)]">{delivery.order?.reference ?? "—"} · {delivery.branch?.name ?? "—"}</p>
              {delivery.driverProfile && <p className="text-xs text-[var(--admin-muted)]">Repartidor: {delivery.driverProfile.name}</p>}
            </button>
          ))}
        </div>

        <div>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-black">{selected.number}</h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${statusColor(selected.status)}`}>{statusLabel(selected.status)}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">{selected.customerName} · {selected.order?.reference ?? "—"}</p>
                <p className="text-sm text-[var(--admin-muted)]">{selected.deliveryAddress}</p>
                <p className="text-sm text-[var(--admin-muted)]">{selected.contactPhone} · {selected.contactName}</p>
                {selected.instructions && <p className="text-xs text-[var(--admin-muted)]">Instrucciones: {selected.instructions}</p>}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--admin-muted)]">Lat:</span> {selected.latitude ?? "—"}</div>
                  <div><span className="text-[var(--admin-muted)]">Lng:</span> {selected.longitude ?? "—"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Pedido</p>
                <dl className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--admin-muted)]">Estado</dt>
                    <dd>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${orderStatusColor(selected.order?.status ?? "")}`}>
                        {orderStatusLabel(selected.order?.status ?? "—")}
                      </span>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--admin-muted)]">Modalidad</dt>
                    <dd className="font-bold">{selected.order?.orderType ?? "—"}</dd>
                  </div>
                  {selected.order?.channel && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-[var(--admin-muted)]">Canal</dt>
                      <dd className="font-bold">{selected.order.channel}</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-[var(--admin-muted)]">Total</dt>
                    <dd className="font-bold">{selected.order ? String(selected.order.total) : "—"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Preparación</p>
                <p className={`mt-2 text-sm font-bold ${awaitingKitchen(selected.order?.status) ? "text-amber-300" : "text-emerald-300"}`}>
                  {awaitingKitchen(selected.order?.status)
                    ? "Esperando a cocina"
                    : selected.order?.status === "ready"
                      ? "Listo para retirar"
                      : orderStatusLabel(selected.order?.status ?? "—")}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Repartidor</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select className="input w-auto" defaultValue={selected.driverProfile?.id ? String(selected.driverProfile.id) : ""} onChange={(e) => { const val = e.target.value; if (!val) return; assignDriver(selected.id, Number(val)); }} aria-label="Asignar repartidor">
                    <option value="">Asignar repartidor…</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={String(driver.id)}>{driver.name}</option>
                    ))}
                  </select>
                  {selected.driverProfile && <span className="text-sm text-white">{selected.driverProfile.name}</span>}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Estado</p>
                <div className="mt-2 flex flex-wrap gap-2">
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
              </div>

              {hasMap && selected.latitude && selected.longitude && (
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Ubicación</p>
                  <p className="mt-1 text-sm text-white">Lat: {selected.latitude} · Lng: {selected.longitude}</p>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
                <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Items</p>
                <div className="mt-2 space-y-1">
                  {(selected.items ?? []).map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.productName}</span>
                      <span className="tabular-nums text-[var(--admin-muted)]">x{item.quantityDelivered}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-[var(--admin-muted)]">
              Seleccioná una entrega para ver el detalle.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
