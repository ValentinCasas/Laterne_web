"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

type Driver = {
  id: number;
  name: string;
  phone: string;
  status: string;
  active: boolean;
  notes?: string | null;
  vehicleType?: string | null;
  plate?: string | null;
  color?: string | null;
  capacity?: number | null;
  createdAt: string | Date;
  user?: { id: number; name: string; email: string } | null;
  branches?: Array<{ id: number; name: string; slug: string }>;
  activeDeliveriesCount?: number;
  openIncidents?: number;
  deliveriesToday?: number;
  activeDeliveries?: number;
  avgTotalMinutes?: number;
  lastActivityAt?: string | Date | null;
};

type Branch = { id: number; name: string; slug: string };
type UserOption = { id: number; name: string; email: string };

type Kpis = {
  deliveriesToday: number;
  pendingAssignment: number;
  onTheWay: number;
  incidentsToday: number;
  openIncidents: number;
  avgMinutes: number | null;
  topDrivers: Array<{ driverProfileId: number; delivered: number }>;
};

const STATUS_META: Record<string, { label: string; badge: string }> = {
  AVAILABLE: { label: "Disponible", badge: "bg-emerald-500/15 text-emerald-300" },
  UNAVAILABLE: { label: "No disponible", badge: "bg-amber-500/15 text-amber-300" },
  INACTIVE: { label: "Inactivo", badge: "bg-zinc-500/15 text-zinc-300" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, badge: "bg-zinc-500/15 text-zinc-300" };
}

function swalSuccess(title: string, text?: string) {
  return Swal.fire({ title, text, icon: "success", timer: 1800, showConfirmButton: false, background: "#18181b", color: "#fafafa" });
}

function swalError(title: string, text?: string) {
  return Swal.fire({ title, text: text ?? "Intentá nuevamente.", icon: "error", background: "#18181b", color: "#fafafa" });
}

/** @summary Maestro de repartidores: KPIs del día, listado, filtros y alta/edición. */
export function DriversList({
  initialDrivers,
  branches,
  users,
  canManage,
  kpis,
}: {
  initialDrivers: Driver[];
  branches: Branch[];
  users: UserOption[];
  canManage: boolean;
  kpis: Kpis;
}) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [filterQ, setFilterQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState("");
  const [editing, setEditing] = useState<Driver | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(() => {
    const q = filterQ.trim().toLocaleLowerCase("es");
    return drivers.filter((driver) => {
      if (filterStatus && driver.status !== filterStatus) return false;
      if (filterBranch && !driver.branches?.some((b) => b.id === Number(filterBranch))) return false;
      if (!q) return true;
      const haystack = [driver.name, driver.phone, driver.user?.name, driver.user?.email]
        .filter(Boolean)
        .map((value) => value!.toLocaleLowerCase("es"));
      return haystack.some((value) => value.includes(q));
    });
  }, [drivers, filterQ, filterStatus, filterBranch]);

  const topNames = kpis.topDrivers
    .map((top) => {
      const driver = drivers.find((d) => d.id === top.driverProfileId);
      return driver ? { name: driver.name, delivered: top.delivered } : null;
    })
    .filter((item): item is { name: string; delivered: number } => Boolean(item));

  async function createDriver(data: DriverFormValues) {
    setSaving(true);
    try {
      const response = await scopedFetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json().catch(() => ({}))) as { driver?: Driver; error?: string };
      if (!response.ok || !body.driver) {
        await swalError("No se pudo crear el repartidor", body.error);
        return;
      }
      setDrivers((current) => [body.driver!, ...current]);
      setCreating(false);
      await swalSuccess("Repartidor creado");
    } finally {
      setSaving(false);
    }
  }

  async function updateDriver(id: number, data: DriverFormValues) {
    setSaving(true);
    try {
      const response = await scopedFetch(`/api/admin/drivers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json().catch(() => ({}))) as { driver?: Driver; error?: string };
      if (!response.ok || !body.driver) {
        await swalError("No se pudo actualizar el repartidor", body.error);
        return;
      }
      setDrivers((current) => current.map((d) => (d.id === id ? body.driver! : d)));
      setEditing(null);
      await swalSuccess("Repartidor actualizado");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDriver(driver: Driver) {
    const confirmed = await Swal.fire({
      title: `¿Eliminar a ${driver.name}?`,
      text: "No se puede eliminar si tiene entregas activas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmed.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/drivers/${driver.id}`, { method: "DELETE" });
    const body = (await response.json().catch(() => ({}))) as { error?: string; success?: boolean };
    if (!response.ok || !body.success) {
      await swalError("No se pudo eliminar", body.error);
      return;
    }
    setDrivers((current) => current.filter((d) => d.id !== driver.id));
    await swalSuccess("Repartidor eliminado");
  }

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación"
        title="Repartidores"
        description="Perfiles de repartidores, sucursales habilitadas, entregas y KPIs del día."
        section="repartidores"
        actions={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              Nuevo repartidor
            </button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Entregas del día</p>
          <p className="mt-1 text-3xl font-black text-white">{kpis.deliveriesToday}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Sin asignar</p>
          <p className="mt-1 text-3xl font-black text-amber-300">{kpis.pendingAssignment}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">En camino</p>
          <p className="mt-1 text-3xl font-black text-violet-300">{kpis.onTheWay}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Incidencias abiertas</p>
          <p className="mt-1 text-3xl font-black text-orange-300">{kpis.openIncidents}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs flex-1"
          placeholder="Buscar por nombre, teléfono o usuario…"
          value={filterQ}
          onChange={(e) => setFilterQ(e.target.value)}
        />
        <select className="input w-auto" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="AVAILABLE">Disponible</option>
          <option value="UNAVAILABLE">No disponible</option>
          <option value="INACTIVE">Inactivo</option>
        </select>
        <select className="input w-auto" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} aria-label="Filtrar por sucursal">
          <option value="">Todas las sucursales</option>
          {branches.map((branch) => (
            <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 space-y-2">
        {visible.length === 0 && <p className="card p-6 text-center text-[var(--admin-muted)]">Sin repartidores para estos filtros.</p>}
        {visible.map((driver) => {
          const meta = statusMeta(driver.status);
          return (
            <div key={driver.id} className="card flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-white">{driver.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${meta.badge}`}>{meta.label}</span>
                  {!driver.active && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-black text-red-300">Desactivado</span>}
                </div>
                <p className="mt-1 text-xs text-[var(--admin-muted)]">
                  {driver.phone} · {driver.user ? `${driver.user.name} (${driver.user.email})` : "Sin usuario de login"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {driver.branches && driver.branches.length > 0 ? (
                    driver.branches.map((branch) => (
                      <span key={branch.id} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-[var(--admin-muted)]">
                        {branch.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-amber-300">Sin sucursales habilitadas</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-center">
                <div>
                  <p className="text-lg font-black text-white">{driver.activeDeliveriesCount ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--admin-muted)]">Activas</p>
                </div>
                <div>
                  <p className="text-lg font-black text-white">{driver.deliveriesToday ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--admin-muted)]">Hoy</p>
                </div>
                <div>
                  <p className="text-lg font-black text-orange-300">{driver.openIncidents ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--admin-muted)]">Incidencias</p>
                </div>
                <div>
                  <p className="text-lg font-black text-violet-300">{driver.avgTotalMinutes ?? 0}m</p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--admin-muted)]">Tiempo medio</p>
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-secondary text-xs" onClick={() => setEditing(driver)}>
                      Editar
                    </button>
                    <button type="button" className="btn btn-secondary text-xs text-red-300" onClick={() => deleteDriver(driver)}>
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {topNames.length > 0 && (
        <div className="card mt-6 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-muted)]">Top repartidores del día</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topNames.map((top) => (
              <span key={top.name} className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                {top.name} · {top.delivered}
              </span>
            ))}
          </div>
        </div>
      )}

      {(creating || editing) && canManage && (
        <DriverFormModal
          driver={editing}
          branches={branches}
          users={users}
          saving={saving}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={(data) => (editing ? updateDriver(editing.id, data) : createDriver(data))}
        />
      )}
    </section>
  );
}

type DriverFormValues = {
  name: string;
  phone: string;
  userId?: number | null;
  status: string;
  active: boolean;
  vehicleType?: string | null;
  plate?: string | null;
  color?: string | null;
  capacity?: number | null;
  notes?: string | null;
  branchIds: number[];
};

function DriverFormModal({
  driver,
  branches,
  users,
  saving,
  onClose,
  onSubmit,
}: {
  driver: Driver | null;
  branches: Branch[];
  users: UserOption[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (data: DriverFormValues) => Promise<void>;
}) {
  const [name, setName] = useState(driver?.name ?? "");
  const [phone, setPhone] = useState(driver?.phone ?? "");
  const [userId, setUserId] = useState<string>(driver?.user?.id ? String(driver.user.id) : "");
  const [status, setStatus] = useState(driver?.status ?? "AVAILABLE");
  const [active, setActive] = useState(driver?.active ?? true);
  const [vehicleType, setVehicleType] = useState(driver?.vehicleType ?? "");
  const [plate, setPlate] = useState(driver?.plate ?? "");
  const [color, setColor] = useState(driver?.color ?? "");
  const [capacity, setCapacity] = useState(driver?.capacity ? String(driver.capacity) : "");
  const [notes, setNotes] = useState(driver?.notes ?? "");
  const [branchIds, setBranchIds] = useState<number[]>(
    (driver?.branches ?? []).map((b) => b.id),
  );

  function toggleBranch(branchId: number) {
    setBranchIds((current) =>
      current.includes(branchId) ? current.filter((id) => id !== branchId) : [...current, branchId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      userId: userId ? Number(userId) : null,
      status,
      active,
      vehicleType: vehicleType.trim() || null,
      plate: plate.trim() || null,
      color: color.trim() || null,
      capacity: capacity ? Number(capacity) : null,
      notes: notes.trim() || null,
      branchIds,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#1c1c22] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white">{driver ? "Editar repartidor" : "Nuevo repartidor"}</h2>
          <button type="button" className="text-[var(--admin-muted)] hover:text-white" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-name">Nombre *</label>
              <input id="d-name" className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-phone">Teléfono *</label>
              <input id="d-phone" className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={60} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-user">Usuario (opcional)</label>
              <select id="d-user" className="input mt-1" value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Sin usuario de login</option>
                {users.map((user) => (
                  <option key={user.id} value={String(user.id)}>{user.name} ({user.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-status">Estado *</label>
              <select id="d-status" className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="AVAILABLE">Disponible</option>
                <option value="UNAVAILABLE">No disponible</option>
                <option value="INACTIVE">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-vehicle">Vehículo</label>
              <input id="d-vehicle" className="input mt-1" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} maxLength={80} />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-plate">Patente</label>
              <input id="d-plate" className="input mt-1" value={plate} onChange={(e) => setPlate(e.target.value)} maxLength={20} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-color">Color</label>
              <input id="d-color" className="input mt-1" value={color} onChange={(e) => setColor(e.target.value)} maxLength={60} />
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-capacity">Capacidad</label>
              <input id="d-capacity" className="input mt-1" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--admin-muted)]" htmlFor="d-notes">Notas</label>
            <textarea id="d-notes" className="input mt-1 min-h-20 w-full" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--admin-muted)]">Sucursales habilitadas</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {branches.map((branch) => (
                <label
                  key={branch.id}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${branchIds.includes(branch.id) ? "border-pink-500/50 bg-pink-500/10 text-white" : "border-white/10 text-[var(--admin-muted)]"}`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={branchIds.includes(branch.id)}
                    onChange={() => toggleBranch(branch.id)}
                  />
                  {branch.name}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--admin-muted)]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Perfil activo (puede recibir entregas)
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando…" : driver ? "Guardar cambios" : "Crear repartidor"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DriversList;