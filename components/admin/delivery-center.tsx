"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Swal from "sweetalert2";
import {
  PageHeader,
  SearchBox,
  StatusBadge,
  ActionMenu,
  NumberFlow,
  Drawer,
  Pagination,
  Timeline,
  UserAvatar,
} from "@/components/admin/ui";
import { Icon } from "@/components/admin/ui/icons";
import { DeliveryMap, type DeliveryMapPosition } from "@/components/admin/delivery-map";
import { avatarUrl } from "@/components/admin/profile-menu";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { canRetireDelivery } from "@/lib/delivery-drivers";
import { orderStatusLabel } from "@/lib/orders";
import { normalizeDeliveryDetail, type DeliveryDetail } from "@/lib/delivery-detail";
import { gpsFreshness } from "@/lib/delivery-tracking";

type Delivery = DeliveryDetail;

type Branch = {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
};
type Driver = {
  id: number;
  name: string;
  phone?: string;
  status?: string;
  user?: { imageUrl?: string | null } | null;
  branches?: Array<{ branchId: number }>;
};

type TeamGroup = {
  key: string;
  name: string;
  members: Array<{
    id: number;
    name: string;
    email: string;
    imageUrl?: string | null;
    driverProfile?: { id: number; status: string } | null;
  }>;
};

type DeliveryCenterProps = {
  initialDeliveries: Delivery[];
  branches: Branch[];
  drivers: Driver[];
  mapEnabled: boolean;
  initialPositions: DeliveryMapPosition[];
  teamHierarchy: TeamGroup[];
  canViewTeam: boolean;
  canViewDrivers: boolean;
  canConfigureDelivery: boolean;
  driverPanelHref?: string;
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

const FINAL_DELIVERY_STATUSES = new Set(["DELIVERED", "FAILED", "CANCELLED"]);

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
export function DeliveryCenter({
  initialDeliveries,
  branches,
  drivers,
  mapEnabled,
  initialPositions,
  teamHierarchy,
  canViewTeam,
  canViewDrivers,
  canConfigureDelivery,
  driverPanelHref,
}: DeliveryCenterProps) {
  const pathname = usePathname();
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [positions, setPositions] = useState<DeliveryMapPosition[]>(initialPositions);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDriver, setFilterDriver] = useState("");
  const [filterQ, setFilterQ] = useState("");
  const [selected, setSelected] = useState<Delivery | null>(initialDeliveries[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<"deliveries" | "detail">("deliveries");
  const [showMap, setShowMap] = useState(true);
  const [showTeam, setShowTeam] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [gpsNow, setGpsNow] = useState(() => Date.now());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [draggedDeliveryId, setDraggedDeliveryId] = useState<number | null>(null);
  const [draggedOverDriverId, setDraggedOverDriverId] = useState<number | null>(null);
  const [assignmentDeliveryId, setAssignmentDeliveryId] = useState<number | null>(null);

  const hasMap = mapEnabled;

  /** @summary Abre el panel propio o explica el requisito sin enviar al usuario a una respuesta 403. */
  async function openDriverPanel() {
    if (driverPanelHref) {
      window.location.assign(driverPanelHref);
      return;
    }

    const result = await Swal.fire({
      title: "Panel del repartidor",
      text: "Esta vista personal está disponible para usuarios vinculados a un perfil de repartidor.",
      icon: "info",
      showConfirmButton: true,
      showCancelButton: canViewDrivers,
      confirmButtonText: canViewDrivers ? "Ver repartidores" : "Entendido",
      cancelButtonText: "Cerrar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
    if (result.isConfirmed && canViewDrivers) {
      window.location.assign(adminHrefFromPathname(pathname, "/admin/repartidores"));
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void (async () => {
        if (saving) return;
        const positionPath = filterBranch
          ? `/api/admin/drivers/positions?branchId=${encodeURIComponent(filterBranch)}`
          : "/api/admin/drivers/positions";
        const [deliveryResponse, positionResponse] = await Promise.all([
          scopedFetch("/api/admin/delivery?limit=200").catch(() => null),
          hasMap ? scopedFetch(positionPath).catch(() => null) : Promise.resolve(null),
        ]);
        if (deliveryResponse?.ok) {
          const body = (await deliveryResponse.json().catch(() => null)) as { items?: Delivery[] } | null;
          if (body?.items) {
            const fresh = body.items.map(normalizeDeliveryDetail);
            setDeliveries(fresh);
            setSelected((current) => {
              if (!current) return fresh[0] ?? null;
              const match = fresh.find((item) => item.id === current.id);
              return match ? { ...match, items: match.items ?? [] } : current;
            });
          }
        }
        if (positionResponse?.ok) {
          const body = (await positionResponse.json().catch(() => null)) as {
            items?: DeliveryMapPosition[];
          } | null;
          if (body?.items) setPositions(body.items);
        }
      })();
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [filterBranch, hasMap, saving]);

  useEffect(() => {
    const timer = window.setInterval(() => setGpsNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedDeliveries = visible.slice((safePage - 1) * pageSize, safePage * pageSize);

  const assignableDeliveries = useMemo(
    () => visible.filter((delivery) => !FINAL_DELIVERY_STATUSES.has(delivery.status)),
    [visible],
  );

  const assignmentDelivery = useMemo(
    () => deliveries.find((delivery) => delivery.id === assignmentDeliveryId) ?? null,
    [assignmentDeliveryId, deliveries],
  );

  /** @summary Determina si un repartidor puede recibir la entrega según la sucursal habilitada. */
  function driverCanReceive(driver: Driver, delivery: Delivery | null) {
    if (!delivery?.branch?.id) return true;
    return (driver.branches ?? []).some((branch) => branch.branchId === delivery.branch?.id);
  }

  /** @summary Selecciona una entrega desde lista o mapa y abre el detalle en pantallas compactas. */
  const selectDelivery = useCallback((deliveryId: number) => {
    const match = deliveries.find((delivery) => delivery.id === deliveryId);
    if (match) setSelected(match);
    if (window.matchMedia("(max-width: 1023px)").matches) setMobileTab("detail");
  }, [deliveries]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const d of deliveries) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }
    return counts;
  }, [deliveries]);

  const driverCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const delivery of deliveries) {
      if (["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status)) continue;
      const driverId = delivery.driverProfile?.id;
      if (driverId) counts.set(driverId, (counts.get(driverId) ?? 0) + 1);
    }
    return counts;
  }, [deliveries]);

  const mapPositions = useMemo(() => {
    if (!filterBranch) return positions;
    const branchId = Number(filterBranch);
    const visibleDeliveryIds = new Set(
      deliveries.filter((delivery) => delivery.branch?.id === branchId).map((delivery) => delivery.id),
    );
    return positions.filter(
      (position) => position.branchId === branchId || Boolean(position.deliveryId && visibleDeliveryIds.has(position.deliveryId)),
    );
  }, [deliveries, filterBranch, positions]);

  const selectedMapBranch = useMemo(() => {
    if (filterBranch) return branches.find((branch) => branch.id === Number(filterBranch)) ?? branches[0] ?? null;
    return branches[0] ?? null;
  }, [branches, filterBranch]);

  async function assignDriver(deliveryId: number, driverProfileId: number) {
    const current = deliveries.find((delivery) => delivery.id === deliveryId);
    if (!current || FINAL_DELIVERY_STATUSES.has(current.status)) return;
    if (current.driverProfile?.id === driverProfileId) {
      setAssignmentDeliveryId(null);
      return;
    }

    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverProfileId }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: Delivery; error?: string };
      const delivery = body.delivery ? normalizeDeliveryDetail(body.delivery) : undefined;
      if (!response.ok || !delivery) {
        await Swal.fire({
          title: "No se pudo asignar",
          text: body.error ?? "Intentá nuevamente.",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? delivery : d)));
      setSelected((current) => (current?.id === deliveryId ? delivery : current));
      setAssignmentDeliveryId(null);
      await Swal.fire({
        title: "Envío reasignado",
        icon: "success",
        toast: true,
        position: "top-end",
        timer: 1100,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
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
        await Swal.fire({
          title: "No se pudo actualizar",
          text: body.error ?? "Intentá nuevamente.",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? delivery : d)));
      setSelected((current) => (current?.id === deliveryId ? delivery : current));
    } finally {
      setSaving(false);
    }
  }

  /** @summary Guarda coordenadas confirmadas y refresca lista, detalle y mapa con el mismo contrato. */
  async function updateCoordinates(deliveryId: number, latitude: number, longitude: number) {
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/deliveries/${deliveryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: Delivery; error?: string };
      const delivery = body.delivery ? normalizeDeliveryDetail(body.delivery) : undefined;
      if (!response.ok || !delivery) {
        await Swal.fire({ title: "No se pudo guardar la ubicación", text: body.error ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
        return false;
      }
      setDeliveries((current) => current.map((item) => (item.id === deliveryId ? delivery : item)));
      setSelected((current) => (current?.id === deliveryId ? delivery : current));
      return true;
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
        await Swal.fire({
          title: "No se pudo anular",
          text: body.error ?? "Intentá nuevamente.",
          icon: "error",
          background: "#18181b",
          color: "#fafafa",
        });
        return;
      }
      setDeliveries((current) => current.map((d) => (d.id === deliveryId ? delivery : d)));
      setSelected((current) => (current?.id === deliveryId ? delivery : current));
      await Swal.fire({
        title: "Entrega anulada",
        text: "Las cantidades volvieron al pedido.",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        background: "#18181b",
        color: "#fafafa",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-w-0 pb-6">
      <PageHeader
        eyebrow="Delivery"
        title="Centro de delivery"
        description="Seguimiento de entregas, repartidores y estado de pedidos."
        section="delivery"
      />

      <nav aria-label="Accesos de Delivery" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <a className="admin-button-secondary shrink-0 border-[var(--admin-primary)]/45 text-white" href={adminHrefFromPathname(pathname, "/admin/delivery")}>
          Centro de Delivery
        </a>
        {canViewDrivers && (
          <a className="admin-button-secondary shrink-0" href={adminHrefFromPathname(pathname, "/admin/repartidores")}>
            Repartidores
          </a>
        )}
        {hasMap && (
          <a className="admin-button-secondary shrink-0" href="#delivery-map" onClick={() => setShowMap(true)}>
            Mapa
          </a>
        )}
        <button className="admin-button-secondary shrink-0" type="button" onClick={() => void openDriverPanel()}>
          Panel del repartidor
        </button>
        {canConfigureDelivery && (
          <a className="admin-button-secondary shrink-0" href={adminHrefFromPathname(pathname, "/admin/integraciones#delivery-map")}>
            Configuración
          </a>
        )}
      </nav>

      {!hasMap && (
        <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-2 text-xs text-amber-200">
          OpenFreeMap está desactivado para este tenant. Podés volver a habilitarlo desde{" "}
          <a className="font-bold underline" href={adminHrefFromPathname(pathname, "/admin/integraciones#delivery-map")}>Integraciones</a>.
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => { setFilterStatus(""); setPage(1); }}
          className={`min-h-10 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
            !filterStatus ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
          }`}
        >
          Todos (<NumberFlow value={deliveries.length} />)
        </button>
        {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => { setFilterStatus(filterStatus === status ? "" : status); setPage(1); }}
            className={`min-h-10 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filterStatus === status ? statusColor(status) : "text-zinc-400 hover:text-white"
            }`}
          >
            {STATUS_LABELS[status]}
            {statusCounts[status] ? (
              <>
                {" "}
                <NumberFlow value={statusCounts[status]} />
              </>
            ) : (
              ""
            )}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 sm:p-4">
        <SearchBox
          value={filterQ}
          onChange={(value) => { setFilterQ(value); setPage(1); }}
          placeholder="Buscar por número, pedido o cliente…"
          className="min-w-[240px] flex-1"
        />
        <select
          className="input min-h-11 w-auto text-sm"
          value={filterBranch}
          onChange={(e) => { setFilterBranch(e.target.value); setPage(1); }}
          aria-label="Sucursal"
        >
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>
              {branch.name}
            </option>
          ))}
        </select>
        <select
          className="input min-h-11 w-auto text-sm"
          value={filterDriver}
          onChange={(e) => { setFilterDriver(e.target.value); setPage(1); }}
          aria-label="Repartidor"
        >
          <option value="">Todos los repartidores</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={String(driver.id)}>
              {driver.name}
            </option>
          ))}
        </select>
        {hasMap && (
          <button
            type="button"
            className={`admin-button-secondary min-h-11 px-4 text-sm ${showMap ? "border-[var(--admin-primary)]/45 text-white" : ""}`}
            onClick={() => setShowMap((current) => !current)}
            aria-pressed={showMap}
          >
            {showMap ? "Ocultar mapa" : "Ver mapa"}
          </button>
        )}
        {canViewTeam && (
          <button type="button" className="admin-button-secondary min-h-11 px-4 text-sm" onClick={() => setShowTeam(true)}>
            Equipo
          </button>
        )}
      </div>

      <section
        className="mb-5 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-card)]"
        aria-label="Tablero de asignación"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold text-white">
              <Icon name="repeat" className="h-4 w-4 text-[var(--admin-primary)]" />
              Pasar envío
            </h2>
            <p className="mt-0.5 text-xs text-[var(--admin-muted)]">
              Arrastrá una ficha sobre un repartidor. En el teléfono: tocá el envío y después la persona.
            </p>
          </div>
          {assignmentDelivery && (
            <button
              type="button"
              className="min-h-9 rounded-lg border border-[var(--admin-border)] px-3 text-xs font-bold text-zinc-300 hover:bg-[var(--admin-row-hover)]"
              onClick={() => setAssignmentDeliveryId(null)}
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(240px,0.75fr)_minmax(0,1.25fr)] lg:p-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-[var(--admin-muted)]">
              <span>Envíos activos</span>
              <span>{assignableDeliveries.length}</span>
            </div>
            <div className="admin-custom-scroll flex max-h-56 gap-2 overflow-auto pb-1 lg:grid lg:grid-cols-1">
              {assignableDeliveries.length === 0 ? (
                <div className="min-w-full rounded-xl border border-dashed border-[var(--admin-border)] p-4 text-center text-xs text-[var(--admin-muted)]">
                  No hay envíos activos para estos filtros.
                </div>
              ) : (
                assignableDeliveries.map((delivery) => {
                  const isChosen = assignmentDeliveryId === delivery.id;
                  return (
                    <button
                      key={delivery.id}
                      type="button"
                      className={`min-w-56 rounded-xl border p-3 text-left transition-[transform,border-color,background-color,opacity] duration-150 active:scale-[.98] lg:min-w-0 ${
                        isChosen
                          ? "border-[var(--admin-primary)] bg-[var(--admin-primary-soft)]"
                          : "border-[var(--admin-border)] bg-[var(--admin-bg)] hover:border-zinc-600"
                      } ${draggedDeliveryId === delivery.id ? "scale-[.98] opacity-55" : ""}`}
                      onClick={() => {
                        setAssignmentDeliveryId((current) => (current === delivery.id ? null : delivery.id));
                        setSelected(delivery);
                      }}
                      draggable={!saving}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", String(delivery.id));
                        setDraggedDeliveryId(delivery.id);
                        setAssignmentDeliveryId(delivery.id);
                      }}
                      onDragEnd={() => {
                        setDraggedDeliveryId(null);
                        setDraggedOverDriverId(null);
                      }}
                      aria-pressed={isChosen}
                      aria-label={`Preparar envío ${delivery.number} para reasignar`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-extrabold text-white">{delivery.number}</span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-300">{delivery.customerName}</span>
                        </span>
                        <Icon name="package" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" />
                      </span>
                      <span className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[var(--admin-muted)]">
                        <span className="truncate">{delivery.driverProfile?.name ?? "Sin repartidor"}</span>
                        <span className="shrink-0">{delivery.branch?.name ?? "Sin sucursal"}</span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.14em] text-[var(--admin-muted)]">
              <span>Repartidores</span>
              <span>{drivers.length}</span>
            </div>
            {drivers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--admin-border)] p-4 text-center text-xs text-[var(--admin-muted)]">
                Todavía no hay repartidores activos.
              </div>
            ) : (
              <div className="admin-custom-scroll grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                {drivers.map((driver) => {
                  const canReceive = driverCanReceive(driver, assignmentDelivery);
                  const alreadyAssigned = assignmentDelivery?.driverProfile?.id === driver.id;
                  const isDropTarget = draggedOverDriverId === driver.id;
                  const canAssign = Boolean(assignmentDelivery && canReceive && !alreadyAssigned && !saving);
                  return (
                    <button
                      key={driver.id}
                      type="button"
                      data-driver-profile-id={driver.id}
                      onClick={() => {
                        if (canAssign && assignmentDelivery) void assignDriver(assignmentDelivery.id, driver.id);
                      }}
                      onDragOver={(event) => {
                        const dragged = deliveries.find((delivery) => delivery.id === draggedDeliveryId) ?? null;
                        if (!dragged || saving || !driverCanReceive(driver, dragged) || dragged.driverProfile?.id === driver.id) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        setDraggedOverDriverId(driver.id);
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDraggedOverDriverId(null);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const delivery = deliveries.find((item) => item.id === draggedDeliveryId) ?? null;
                        setDraggedDeliveryId(null);
                        setDraggedOverDriverId(null);
                        if (delivery && driverCanReceive(driver, delivery) && delivery.driverProfile?.id !== driver.id) {
                          void assignDriver(delivery.id, driver.id);
                        }
                      }}
                      className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 text-left transition-[transform,border-color,background-color,box-shadow,opacity] duration-150 ${
                        isDropTarget
                          ? "scale-[1.02] border-[var(--admin-primary)] bg-[var(--admin-primary-soft)] shadow-[0_0_0_3px_var(--admin-primary-soft)]"
                          : canAssign
                            ? "border-emerald-500/35 bg-emerald-500/[.06] hover:border-emerald-400/70 hover:bg-emerald-500/[.1]"
                            : "border-[var(--admin-border)] bg-[var(--admin-bg)]"
                      } ${assignmentDelivery && !canReceive ? "opacity-45" : ""}`}
                      aria-disabled={!canAssign}
                      aria-label={
                        assignmentDelivery
                          ? `Asignar ${assignmentDelivery.number} a ${driver.name}`
                          : `Repartidor ${driver.name}`
                      }
                    >
                      <UserAvatar
                        name={driver.name}
                        src={avatarUrl(driver.user?.imageUrl ?? undefined)}
                        size="sm"
                        status={driver.status === "AVAILABLE" ? "online" : "away"}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-zinc-100">{driver.name}</span>
                        <span className="mt-0.5 block text-[10px] text-[var(--admin-muted)]">
                          {assignmentDelivery && !canReceive
                            ? "Otra sucursal"
                            : alreadyAssigned
                              ? "Ya lo tiene"
                              : `${driverCounts.get(driver.id) ?? 0} activas`}
                        </span>
                      </span>
                      {canAssign && <Icon name="arrow-right" className="h-4 w-4 shrink-0 text-emerald-300" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {hasMap && showMap && (
        <div id="delivery-map" className="mb-5 scroll-mt-24 overflow-hidden rounded-2xl border border-[var(--admin-border)] shadow-[var(--admin-shadow-card)]">
          <DeliveryMap
            branch={selectedMapBranch}
            positions={mapPositions}
            deliveries={visible}
            selectedDeliveryId={selected?.id}
            onSelectDelivery={selectDelivery}
            onSelectDriver={setSelectedDriverId}
          />
        </div>
      )}

      <div className="mb-3 grid grid-cols-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 lg:hidden" role="tablist" aria-label="Contenido de Delivery">
        <button type="button" role="tab" aria-selected={mobileTab === "deliveries"} className={`min-h-11 rounded-lg text-sm font-bold ${mobileTab === "deliveries" ? "bg-[var(--admin-primary-soft)] text-white" : "text-[var(--admin-muted)]"}`} onClick={() => setMobileTab("deliveries")}>
          Entregas
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === "detail"} className={`min-h-11 rounded-lg text-sm font-bold ${mobileTab === "detail" ? "bg-[var(--admin-primary-soft)] text-white" : "text-[var(--admin-muted)]"}`} onClick={() => setMobileTab("detail")}>
          Detalle
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className={`${mobileTab === "deliveries" ? "flex" : "hidden"} h-[560px] flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:flex lg:h-[680px]`}>
          <div className="shrink-0 border-b border-[var(--admin-border)] px-5 py-4">
            <span className="text-sm font-bold uppercase tracking-wider text-[var(--admin-muted)]">
              Entregas (<NumberFlow value={visible.length} />)
            </span>
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {visible.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--admin-muted)]">
                Sin entregas para los filtros seleccionados.
              </div>
            ) : (
              <div className="divide-y divide-[var(--admin-border)]/50">
                {pagedDeliveries.map((delivery) => (
                  <button
                    key={delivery.id}
                    className={`admin-row-enter w-full px-5 py-4 text-left transition-[transform,opacity,background-color] duration-150 hover:bg-[var(--admin-row-hover)] ${
                      selected?.id === delivery.id
                        ? "bg-[var(--admin-primary-soft)] shadow-[inset_2px_0_var(--admin-primary)]"
                        : ""
                    } ${draggedDeliveryId === delivery.id ? "scale-[.99] opacity-55" : ""}`}
                    onClick={() => {
                      selectDelivery(delivery.id);
                    }}
                    draggable={!saving && !FINAL_DELIVERY_STATUSES.has(delivery.status)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(delivery.id));
                      setDraggedDeliveryId(delivery.id);
                      setAssignmentDeliveryId(delivery.id);
                    }}
                    onDragEnd={() => {
                      setDraggedDeliveryId(null);
                      setDraggedOverDriverId(null);
                    }}
                    aria-grabbed={draggedDeliveryId === delivery.id}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusColor(delivery.status).split(" ")[0]}`}
                      />
                      <span className="truncate text-base font-bold text-white">{delivery.customerName}</span>
                      <StatusBadge status={statusLabel(delivery.status)} tone={delivery.status === "DELIVERED" ? "success" : delivery.status === "INCIDENT" || delivery.status === "FAILED" ? "danger" : "warning"} />
                    </div>
                    <div className="mt-2 grid gap-x-4 gap-y-1 text-sm text-[var(--admin-muted)] sm:grid-cols-2">
                      <span><strong className="font-semibold text-zinc-300">Pedido:</strong> {delivery.order?.reference ?? "—"}</span>
                      <span><strong className="font-semibold text-zinc-300">Entrega:</strong> {delivery.number}</span>
                      <span><strong className="font-semibold text-zinc-300">Sucursal:</strong> {delivery.branch?.name ?? "—"}</span>
                      <span><strong className="font-semibold text-zinc-300">Repartidor:</strong> {delivery.driverProfile?.name ?? "Sin asignar"}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Pagination
            page={safePage}
            pageSize={pageSize}
            totalItems={visible.length}
            onPageChange={setPage}
            onPageSizeChange={(value) => { setPageSize(value); setPage(1); }}
          />
        </div>

        <div
          className={`${mobileTab === "detail" ? "block" : "hidden"} h-[560px] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 sm:p-6 lg:block lg:h-[680px] ${
            !selected ? "items-center justify-center" : ""
          }`}
        >
          {selected ? (
            <DeliveryDetailPanel
              delivery={selected}
              drivers={drivers}
              driverPosition={positions.find((position) => position.driverProfileId === selected.driverProfile?.id) ?? null}
              gpsNow={gpsNow}
              hasMap={hasMap}
              saving={saving}
              pathname={pathname}
              onAssignDriver={assignDriver}
              onUpdateStatus={updateStatus}
              onUpdateCoordinates={updateCoordinates}
              onReverse={reverseDelivery}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[var(--admin-muted)]">
              Seleccioná una entrega para ver el detalle.
            </div>
          )}
        </div>
      </div>

      <Drawer open={showTeam} onClose={() => setShowTeam(false)} title="Estructura del equipo" width="720px">
        <DeliveryTeamHierarchy groups={teamHierarchy} drivers={drivers} />
      </Drawer>

      <Drawer
        open={selectedDriverId !== null}
        onClose={() => setSelectedDriverId(null)}
        title="Seguimiento del repartidor"
        width="460px"
      >
        {selectedDriverId !== null && (
          <DriverMapPreview
            driver={drivers.find((driver) => driver.id === selectedDriverId) ?? null}
            position={positions.find((position) => position.driverProfileId === selectedDriverId) ?? null}
            deliveries={deliveries.filter(
              (delivery) =>
                delivery.driverProfile?.id === selectedDriverId &&
                !["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status),
            )}
            now={gpsNow}
            onSelectDelivery={(deliveryId) => {
              setSelectedDriverId(null);
              selectDelivery(deliveryId);
            }}
          />
        )}
      </Drawer>
    </section>
  );
}

/** @summary Preview operativo abierto desde el avatar del mapa, con frescura y asignaciones actuales. */
function DriverMapPreview({
  driver,
  position,
  deliveries,
  now,
  onSelectDelivery,
}: {
  driver: Driver | null;
  position: DeliveryMapPosition | null;
  deliveries: Delivery[];
  now: number;
  onSelectDelivery: (deliveryId: number) => void;
}) {
  if (!driver) return <p className="text-sm text-[var(--admin-muted)]">El repartidor ya no está disponible.</p>;
  const freshness = position ? gpsFreshness(position.recordedAt, now) : null;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] p-4">
        <UserAvatar name={driver.name} src={avatarUrl(driver.user?.imageUrl ?? undefined)} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-black text-[var(--admin-text)]">{driver.name}</p>
          <p className="text-xs text-[var(--admin-muted)]">{driver.status ?? "Sin estado operativo"}</p>
          <StatusBadge
            status={freshness?.label ?? "Sin ubicación"}
            tone={freshness?.state === "live" ? "success" : freshness?.state === "recent" ? "warning" : "default"}
          />
        </div>
      </div>
      {position && (
        <dl className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--admin-border)] p-4 text-xs">
          <div><dt className="text-[var(--admin-muted)]">Última actualización</dt><dd className="mt-1 font-bold text-white">{new Date(position.recordedAt).toLocaleString("es-AR")}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Precisión</dt><dd className="mt-1 font-bold text-white">{position.accuracy ? `±${Math.round(Number(position.accuracy))} m` : "No informada"}</dd></div>
        </dl>
      )}
      <section>
        <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-muted)]">Entregas asignadas</h3>
        {deliveries.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-[var(--admin-border)] p-4 text-sm text-[var(--admin-muted)]">No tiene entregas activas.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {deliveries.map((delivery) => (
              <button
                key={delivery.id}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-[var(--admin-border)] p-3 text-left hover:bg-[var(--admin-row-hover)]"
                onClick={() => onSelectDelivery(delivery.id)}
              >
                <span><span className="block text-sm font-bold text-white">{delivery.number}</span><span className="block text-xs text-[var(--admin-muted)]">{delivery.customerName}</span></span>
                <StatusBadge status={statusLabel(delivery.status)} tone="info" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** @summary Visualiza los niveles de acceso del tenant y distingue repartidores operativos. */
function DeliveryTeamHierarchy({ groups, drivers }: { groups: TeamGroup[]; drivers: Driver[] }) {
  const linkedDriverIds = new Set(
    groups.flatMap((group) => group.members.flatMap((member) => member.driverProfile?.id ?? [])),
  );
  const unlinkedDrivers = drivers.filter((driver) => !linkedDriverIds.has(driver.id));

  if (groups.length === 0 && drivers.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--admin-border)] p-8 text-center text-sm text-[var(--admin-muted)]">No hay integrantes visibles con tus permisos actuales.</p>;
  }

  return (
    <div>
      <p className="mb-5 text-sm leading-6 text-[var(--admin-muted)]">
        Vista ordenada por nivel de acceso. Los conectores representan la progresión de roles configurada, no una relación de jefatura que no exista en los datos.
      </p>
      <div className="space-y-0">
        {groups.map((group, groupIndex) => (
          <section key={group.key} className="relative pb-6 last:pb-0">
            {groupIndex < groups.length - 1 && <span className="absolute bottom-0 left-5 top-10 w-px bg-[var(--admin-border-strong)]" aria-hidden="true" />}
            <div className="mb-3 flex items-center gap-3">
              <span className="relative z-[1] grid h-10 w-10 place-items-center rounded-xl border border-[var(--admin-primary)]/30 bg-[var(--admin-primary-soft)] text-xs font-black text-[var(--admin-primary)]">
                {groupIndex + 1}
              </span>
              <div>
                <h3 className="font-bold text-[var(--admin-text)]">{group.name}</h3>
                <p className="text-xs text-[var(--admin-muted)]">{group.members.length} integrante{group.members.length === 1 ? "" : "s"}</p>
              </div>
            </div>
            <div className="grid gap-2 pl-[3.25rem] sm:grid-cols-2">
              {group.members.map((member) => (
                <article key={member.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
                  <UserAvatar name={member.name} src={avatarUrl(member.imageUrl ?? undefined)} size="md" status={member.driverProfile?.status === "AVAILABLE" ? "online" : undefined} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--admin-text)]">{member.name}</p>
                    <p className="truncate text-xs text-[var(--admin-muted)]">{member.email}</p>
                    {member.driverProfile && <span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Repartidor · {member.driverProfile.status}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {unlinkedDrivers.length > 0 && (
          <section className="mt-6 border-t border-[var(--admin-border)] pt-5">
            <h3 className="font-bold text-[var(--admin-text)]">Repartidores sin usuario vinculado</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {unlinkedDrivers.map((driver) => (
                <article key={driver.id} className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
                  <UserAvatar name={driver.name} src={avatarUrl(driver.user?.imageUrl ?? undefined)} size="md" />
                  <div className="min-w-0"><p className="truncate text-sm font-bold">{driver.name}</p><p className="text-xs text-[var(--admin-muted)]">{driver.status ?? "Sin estado"}</p></div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** @summary Panel de detalle de una entrega con secciones compactas. */
function DeliveryDetailPanel({
  delivery,
  drivers,
  driverPosition,
  gpsNow,
  hasMap,
  saving,
  pathname,
  onAssignDriver,
  onUpdateStatus,
  onUpdateCoordinates,
  onReverse,
}: {
  delivery: Delivery;
  drivers: Driver[];
  driverPosition: DeliveryMapPosition | null;
  gpsNow: number;
  hasMap: boolean;
  saving: boolean;
  pathname: string;
  onAssignDriver: (deliveryId: number, driverProfileId: number) => void;
  onUpdateStatus: (deliveryId: number, status: DeliveryStatus) => void;
  onUpdateCoordinates: (deliveryId: number, latitude: number, longitude: number) => Promise<boolean>;
  onReverse: (deliveryId: number) => void;
}) {
  async function geocodeAddress() {
    const response = await scopedFetch(`/api/admin/deliveries/${delivery.id}/geocode`, { method: "POST" });
    const body = (await response.json().catch(() => ({}))) as {
      candidates?: Array<{ latitude: number; longitude: number; label: string }>;
      error?: string;
    };
    if (!response.ok || !body.candidates) {
      await Swal.fire({
        title: "Geocodificación no disponible",
        text: body.error ?? "Podés cargar las coordenadas manualmente.",
        icon: "info",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    if (body.candidates.length === 0) {
      await Swal.fire({ title: "Sin coincidencias", text: "Revisá la dirección o cargá las coordenadas manualmente.", icon: "info", background: "#18181b", color: "#fafafa" });
      return;
    }
    const options = Object.fromEntries(body.candidates.map((candidate, index) => [String(index), candidate.label]));
    const result = await Swal.fire<string>({
      title: "Confirmá la ubicación",
      text: "El geocodificador solo propone candidatos; elegí uno después de verificar la dirección.",
      input: "select",
      inputOptions: options,
      showCancelButton: true,
      confirmButtonText: "Usar coordenadas",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed || result.value === undefined) return;
    const candidate = body.candidates[Number(result.value)];
    if (candidate) await onUpdateCoordinates(delivery.id, candidate.latitude, candidate.longitude);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-white">Entrega {delivery.number}</h3>
          <p className="text-sm text-[var(--admin-muted)]">{delivery.customerName}</p>
        </div>
        <ActionMenu
          align="right"
          items={[
            {
              label: "Ver pedido origen",
              onClick: () =>
                window.open(
                  adminHrefFromPathname(pathname, `/admin/pedidos?id=${delivery.order?.id ?? ""}`),
                  "_blank",
                ),
            },
            {
              label: "Ver remito",
              onClick: () =>
                window.open(adminHrefFromPathname(pathname, `/admin/entregas/${delivery.id}`), "_blank"),
            },
            { label: "Anular entrega", tone: "danger", onClick: () => onReverse(delivery.id) },
          ]}
        />
      </div>

      <StatusBadge
        status={statusLabel(delivery.status)}
        tone={
          delivery.status === "DELIVERED"
            ? "success"
            : delivery.status === "INCIDENT" || delivery.status === "FAILED"
              ? "danger"
              : "warning"
        }
      />

      <section className="rounded-xl border border-[var(--admin-border)] p-5">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          General
        </h4>
        <dl className="space-y-3 text-sm">
          <div><dt className="text-[var(--admin-muted)]">Cliente</dt><dd className="mt-1 font-semibold text-white">{delivery.customerName}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Dirección</dt><dd className="mt-1 text-zinc-200">{delivery.deliveryAddress || "Sin dirección"}</dd></div>
          <div><dt className="text-[var(--admin-muted)]">Contacto</dt><dd className="mt-1 text-zinc-200">{delivery.contactPhone || "Sin teléfono"}</dd></div>
        </dl>
      </section>

      {/* Pedido */}
      <section className="rounded-xl border border-[var(--admin-border)] p-5">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          Pedido
        </h4>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--admin-muted)]">Estado</span>
            <StatusBadge
              status={orderStatusLabel(delivery.order?.status ?? "—")}
              tone={delivery.order?.status === "delivered" ? "success" : "info"}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--admin-muted)]">Referencia</span>
            <strong>{delivery.order?.reference ?? "—"}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--admin-muted)]">Total</span>
            <strong className="tabular-nums">{delivery.order ? String(delivery.order.total) : "—"}</strong>
          </div>
        </dl>
      </section>

      {/* Repartidor */}
      <section className="rounded-xl border border-[var(--admin-border)] p-5">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          Repartidor
        </h4>
        <select
          className="input min-h-11 w-full text-sm"
          value={delivery.driverProfile?.id ? String(delivery.driverProfile.id) : ""}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            onAssignDriver(delivery.id, Number(val));
          }}
          aria-label="Asignar repartidor"
        >
          <option value="">Asignar repartidor…</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={String(driver.id)}>
              {driver.name}
            </option>
          ))}
        </select>
        {delivery.driverProfile && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <UserAvatar name={delivery.driverProfile.name} src={avatarUrl(delivery.driverProfile.user?.imageUrl ?? undefined)} size="md" />
            <div className="min-w-0"><p className="text-sm font-semibold text-white">{delivery.driverProfile.name}</p><p className="text-xs text-[var(--admin-muted)]">{delivery.driverProfile.phone ?? "Sin teléfono"}</p></div>
            <StatusBadge
              status={driverPosition ? gpsFreshness(driverPosition.recordedAt, gpsNow).label : "Sin ubicación"}
              tone={driverPosition && gpsFreshness(driverPosition.recordedAt, gpsNow).state === "live" ? "success" : "default"}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-[var(--admin-border)] p-5">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          Items ({delivery.items?.length ?? 0})
        </h4>
        <div className="divide-y divide-[var(--admin-border)]/50">
          {(delivery.items ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-zinc-200">{item.productName}</span>
              <span className="tabular-nums text-[var(--admin-muted)]">x{item.quantityDelivered}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Transiciones de estado */}
      <section className="rounded-xl border border-[var(--admin-border)] p-5">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          Cambiar estado
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABELS) as DeliveryStatus[]).map((status) => {
            const blocked = status === "PICKED_UP" && !canRetireDelivery(delivery.order?.status);
            return (
              <button
                key={status}
                type="button"
                title={blocked ? "El pedido todavía no está listo para retirar" : undefined}
                className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
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

      <section className="rounded-xl border border-[var(--admin-border)] p-5">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          Historial operativo
        </h4>
        <Timeline
          initialLimit={6}
          emptyMessage="Todavía no hay cambios de estado registrados."
          items={(delivery.statusLogs ?? []).map((log) => ({
            id: log.id,
            date: log.changedAt,
            title: statusLabel(log.status),
            description: log.reason ?? (log.previousStatus ? `Desde ${statusLabel(log.previousStatus)}` : "Estado inicial"),
            actor: log.changedBy?.name ?? log.driverProfile?.name,
            tone:
              log.status === "DELIVERED"
                ? "success"
                : log.status === "FAILED" || log.status === "CANCELLED"
                  ? "danger"
                  : log.status === "INCIDENT"
                    ? "warning"
                    : "info",
          }))}
        />
      </section>

      <section className="rounded-xl border border-[var(--admin-border)] p-5">
        <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--admin-muted)]">
          Ubicación del destino
        </h4>
        {delivery.latitude && delivery.longitude ? (
          <p className="text-xs text-[var(--admin-muted)]">
            Lat: {delivery.latitude} · Lng: {delivery.longitude}
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-[var(--admin-muted)]">
              La dirección no se convierte en coordenadas automáticamente. Confirmá un candidato o cargalas manualmente.
            </p>
            {delivery.deliveryAddress && hasMap && (
              <button type="button" className="admin-button-secondary w-full text-xs" disabled={saving} onClick={() => void geocodeAddress()}>
                Buscar coordenadas de la dirección
              </button>
            )}
            <DeliveryCoordinatesEditor
              key={delivery.id}
              saving={saving}
              onSave={(latitude, longitude) => onUpdateCoordinates(delivery.id, latitude, longitude)}
            />
          </div>
        )}
      </section>
    </div>
  );
}

/** @summary Permite confirmar coordenadas manuales sin interpretar ni inventar una dirección. */
function DeliveryCoordinatesEditor({
  saving,
  onSave,
}: {
  saving: boolean;
  onSave: (latitude: number, longitude: number) => Promise<boolean>;
}) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const valid =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    Number.isFinite(parsedLatitude) &&
    Math.abs(parsedLatitude) <= 90 &&
    Number.isFinite(parsedLongitude) &&
    Math.abs(parsedLongitude) <= 180;
  return (
    <form
      className="grid grid-cols-2 gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) void onSave(parsedLatitude, parsedLongitude);
      }}
    >
      <label><span className="label">Latitud</span><input className="input" inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="-33.3017" /></label>
      <label><span className="label">Longitud</span><input className="input" inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="-66.3378" /></label>
      <button className="btn col-span-2" disabled={saving || !valid}>Guardar ubicación</button>
    </form>
  );
}
