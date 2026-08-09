"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { reservationStatuses, reservationStatusLabel, type ReservationStatus } from "@/lib/reservations";

export type ReservationItem = {
  id: number;
  reference: string;
  status: string;
  reservationDate: string;
  reservationTime: string;
  partySize: number;
  sector: string | null;
  customerName: string;
  phone: string;
  email: string;
  notes: string | null;
  reason: string | null;
  source: string;
  createdAt: string;
};

export type ReservationSettingsData = {
  enabled: boolean;
  capacityPerSlot: number;
  slotInterval: number;
  minimumLeadHours: number;
  maximumAdvanceDays: number;
  maximumPartySize: number;
  defaultDuration: number;
  sectors: unknown;
  policy: string | null;
  confirmationMode: string;
};

export type ReservationBlockData = {
  id: number;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  confirmed: "bg-emerald-500/15 text-emerald-300",
  rejected: "bg-red-500/15 text-red-300",
  cancelled: "bg-zinc-500/15 text-zinc-400",
  completed: "bg-sky-500/15 text-sky-300",
  no_show: "bg-violet-500/15 text-violet-300",
};

/** @summary Extrae la fecha local de un valor serializado por el servidor. */
function dateText(value: string) {
  return value.slice(0, 10);
}

/** @summary Extrae el horario HH:mm de un valor temporal serializado. */
function hourText(value: string | null) {
  if (!value) return "";
  return value.includes("T") ? value.slice(11, 16) : value.slice(0, 5);
}

/** @summary Organiza reservas, vistas temporales, estados, capacidad y bloqueos del negocio. */
export function ReservationBoard({
  initialReservations,
  initialSettings,
  initialBlocks,
  today,
}: {
  initialReservations: ReservationItem[];
  initialSettings: ReservationSettingsData;
  initialBlocks: ReservationBlockData[];
  today: string;
}) {
  const [reservations, setReservations] = useState(initialReservations);
  const [settings, setSettings] = useState(initialSettings);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [referenceDate, setReferenceDate] = useState(today);
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReservationItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const visibleReservations = useMemo(() => {
    const anchor = new Date(`${referenceDate}T00:00:00`);
    const weekStart = new Date(anchor);
    weekStart.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const normalizedQuery = query.trim().toLocaleLowerCase("es");

    return reservations
      .filter((reservation) => {
        const date = dateText(reservation.reservationDate);
        if (view === "day" && date !== referenceDate) return false;
        if (view === "month" && date.slice(0, 7) !== referenceDate.slice(0, 7)) return false;
        if (view === "week") {
          const value = new Date(`${date}T00:00:00`);
          if (value < weekStart || value > weekEnd) return false;
        }
        if (status !== "all" && reservation.status !== status) return false;
        if (
          normalizedQuery &&
          !`${reservation.customerName} ${reservation.reference} ${reservation.phone} ${reservation.email}`
            .toLocaleLowerCase("es")
            .includes(normalizedQuery)
        ) {
          return false;
        }
        return true;
      })
      .sort((first, second) =>
        `${first.reservationDate}${first.reservationTime}`.localeCompare(
          `${second.reservationDate}${second.reservationTime}`,
        ),
      );
  }, [query, referenceDate, reservations, status, view]);

  const groupedReservations = useMemo(() => {
    const groups = new Map<string, ReservationItem[]>();
    for (const reservation of visibleReservations) {
      const date = dateText(reservation.reservationDate);
      groups.set(date, [...(groups.get(date) ?? []), reservation]);
    }
    return [...groups.entries()];
  }, [visibleReservations]);

  /** @summary Actualiza una reserva y sincroniza su estado en la lista y el detalle. */
  async function changeStatus(reservation: ReservationItem, nextStatus: ReservationStatus) {
    const response = await fetch(`/api/admin/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    const body = (await response.json()) as { reservation?: ReservationItem; error?: string };
    if (!response.ok || !body.reservation) {
      await Swal.fire({
        title: "No se pudo actualizar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    setReservations((current) =>
      current.map((item) => (item.id === reservation.id ? { ...item, ...body.reservation } : item)),
    );
    setSelected((current) =>
      current?.id === reservation.id ? { ...current, ...body.reservation } : current,
    );
  }

  /** @summary Guarda las reglas de disponibilidad utilizadas por el formulario público. */
  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      enabled: form.get("enabled") === "on",
      capacityPerSlot: Number(form.get("capacityPerSlot")),
      slotInterval: Number(form.get("slotInterval")),
      minimumLeadHours: Number(form.get("minimumLeadHours")),
      maximumAdvanceDays: Number(form.get("maximumAdvanceDays")),
      maximumPartySize: Number(form.get("maximumPartySize")),
      defaultDuration: Number(form.get("defaultDuration")),
      sectors: String(form.get("sectors") ?? "")
        .split(",")
        .map((sector) => sector.trim())
        .filter(Boolean),
      policy: String(form.get("policy") ?? ""),
      confirmationMode: String(form.get("confirmationMode")),
    };
    const response = await fetch("/api/admin/reservations/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { settings?: ReservationSettingsData; error?: string };
    if (!response.ok || !body.settings) {
      await Swal.fire({ title: "No se pudo guardar", text: body.error, icon: "error" });
      return;
    }
    setSettings(body.settings);
    setSettingsOpen(false);
    await Swal.fire({
      title: "Configuración actualizada",
      icon: "success",
      timer: 1400,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  /** @summary Registra un cierre total o por horario para fechas especiales. */
  async function createBlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/admin/reservations/blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as { block?: ReservationBlockData; error?: string };
    if (!response.ok || !body.block) {
      await Swal.fire({ title: "No se pudo bloquear", text: body.error, icon: "error" });
      return;
    }
    setBlocks((current) => [body.block!, ...current]);
    event.currentTarget.reset();
  }

  /** @summary Quita un bloqueo de disponibilidad después de una confirmación visual. */
  async function removeBlock(block: ReservationBlockData) {
    const confirmation = await Swal.fire({
      title: "¿Quitar este bloqueo?",
      text: block.reason,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await fetch(`/api/admin/reservations/blocks/${block.id}`, { method: "DELETE" });
    if (response.ok) setBlocks((current) => current.filter((item) => item.id !== block.id));
  }

  return (
    <section>
      <header className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-500/15 to-zinc-950 p-6 sm:p-8">
        <p className="section-eyebrow text-emerald-300">Operación de salón</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-4xl font-black sm:text-5xl">Reservas</h1>
            <p className="mt-3 text-zinc-500">Capacidad, confirmaciones, bloqueos y próximos visitantes.</p>
          </div>
          <button className="btn" onClick={() => setSettingsOpen((current) => !current)} type="button">
            {settingsOpen ? "Cerrar configuración" : "Configurar reservas"}
          </button>
        </div>
      </header>

      {settingsOpen && (
        <section className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
          <form
            className="grid gap-4 rounded-3xl border border-white/10 bg-zinc-950 p-5 sm:grid-cols-2"
            onSubmit={saveSettings}
          >
            <h2 className="text-2xl font-black sm:col-span-2">Reglas de disponibilidad</h2>
            <label className="flex items-center gap-3 rounded-xl border border-white/10 p-3 sm:col-span-2">
              <input
                name="enabled"
                type="checkbox"
                defaultChecked={settings.enabled}
                className="h-5 w-5 accent-pink-500"
              />
              Reservas públicas habilitadas
            </label>
            {[
              ["capacityPerSlot", "Capacidad por franja", settings.capacityPerSlot],
              ["slotInterval", "Intervalo en minutos", settings.slotInterval],
              ["minimumLeadHours", "Anticipación mínima (horas)", settings.minimumLeadHours],
              ["maximumAdvanceDays", "Anticipación máxima (días)", settings.maximumAdvanceDays],
              ["maximumPartySize", "Tamaño máximo de grupo", settings.maximumPartySize],
              ["defaultDuration", "Duración estimada (minutos)", settings.defaultDuration],
            ].map(([name, label, value]) => (
              <label className="text-sm font-bold" key={String(name)}>
                {label}
                <input
                  className="input mt-2"
                  name={String(name)}
                  type="number"
                  min={0}
                  defaultValue={Number(value)}
                  required
                />
              </label>
            ))}
            <label className="text-sm font-bold sm:col-span-2">
              Sectores, separados por comas
              <input
                className="input mt-2"
                name="sectors"
                defaultValue={Array.isArray(settings.sectors) ? settings.sectors.join(", ") : ""}
              />
            </label>
            <label className="text-sm font-bold">
              Confirmación
              <select className="input mt-2" name="confirmationMode" defaultValue={settings.confirmationMode}>
                <option value="manual">Manual</option>
                <option value="automatic">Automática</option>
              </select>
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Política
              <textarea className="input mt-2 min-h-24" name="policy" defaultValue={settings.policy ?? ""} />
            </label>
            <button className="btn sm:col-span-2">Guardar configuración</button>
          </form>

          <div className="rounded-3xl border border-white/10 bg-zinc-950 p-5">
            <h2 className="text-2xl font-black">Bloqueos</h2>
            <form className="mt-4 grid gap-3" onSubmit={createBlock}>
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="input"
                  name="startDate"
                  type="date"
                  required
                  aria-label="Inicio del bloqueo"
                />
                <input className="input" name="endDate" type="date" required aria-label="Fin del bloqueo" />
                <input className="input" name="startTime" type="time" aria-label="Hora inicial opcional" />
                <input className="input" name="endTime" type="time" aria-label="Hora final opcional" />
              </div>
              <input className="input" name="reason" placeholder="Motivo del bloqueo" required />
              <button className="btn btn-secondary">Agregar bloqueo</button>
            </form>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {blocks.map((block) => (
                <article
                  className="flex items-start justify-between gap-3 rounded-xl bg-white/[.03] p-3"
                  key={block.id}
                >
                  <div>
                    <p className="text-sm font-bold">{block.reason}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {dateText(block.startDate)} → {dateText(block.endDate)}
                      {block.startTime
                        ? ` · ${hourText(block.startTime)} a ${hourText(block.endTime)}`
                        : " · día completo"}
                    </p>
                  </div>
                  <button className="text-sm text-red-300" onClick={() => removeBlock(block)} type="button">
                    Quitar
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-3 md:grid-cols-[auto_auto_1fr_auto]">
        <div className="flex rounded-xl bg-white/5 p-1">
          {(["day", "week", "month"] as const).map((option) => (
            <button
              className={`rounded-lg px-3 py-2 text-sm font-bold ${view === option ? "bg-pink-500" : "text-zinc-500"}`}
              key={option}
              onClick={() => setView(option)}
              type="button"
            >
              {option === "day" ? "Día" : option === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>
        <input
          className="input py-2"
          type="date"
          value={referenceDate}
          onChange={(event) => setReferenceDate(event.target.value)}
        />
        <input
          className="input py-2"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar reserva…"
        />
        <select
          className="input py-2"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          {reservationStatuses.map((option) => (
            <option value={option} key={option}>
              {reservationStatusLabel(option)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 max-h-[720px] space-y-5 overflow-y-auto pr-1">
        {groupedReservations.map(([date, items]) => (
          <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-4" key={date}>
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-black">
                {new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              <span className="text-sm text-zinc-600">
                {items.reduce((sum, item) => sum + item.partySize, 0)} personas
              </span>
            </header>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((reservation) => (
                <article className="rounded-2xl border border-white/10 bg-black p-4" key={reservation.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-pink-300">{reservation.reference}</p>
                      <h3 className="mt-1 font-black">{reservation.customerName}</h3>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${statusColors[reservation.status]}`}
                    >
                      {reservationStatusLabel(reservation.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-zinc-400">
                    {hourText(reservation.reservationTime)} · {reservation.partySize} personas
                    {reservation.sector ? ` · ${reservation.sector}` : ""}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-xs font-bold hover:bg-pink-500"
                      onClick={() => setSelected(reservation)}
                      type="button"
                    >
                      Ver detalle
                    </button>
                    <select
                      className="rounded-lg border border-white/10 bg-zinc-900 px-2 text-xs"
                      value={reservation.status}
                      onChange={(event) => changeStatus(reservation, event.target.value as ReservationStatus)}
                      aria-label={`Cambiar estado de ${reservation.reference}`}
                    >
                      {reservationStatuses.map((option) => (
                        <option value={option} key={option}>
                          {reservationStatusLabel(option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
        {!groupedReservations.length && (
          <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center text-zinc-500">
            No hay reservas para este período y filtro.
          </div>
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/85 p-4"
          onClick={() => setSelected(null)}
        >
          <article
            className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-eyebrow">{selected.reference}</p>
                <h2 className="mt-1 text-3xl font-black">{selected.customerName}</h2>
              </div>
              <button
                className="grid h-10 w-10 place-items-center rounded-full bg-white/5 text-xl"
                onClick={() => setSelected(null)}
                type="button"
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                ["Fecha", dateText(selected.reservationDate)],
                ["Horario", hourText(selected.reservationTime)],
                ["Personas", String(selected.partySize)],
                ["Sector", selected.sector ?? "Sin preferencia"],
                ["Teléfono", selected.phone],
                ["Email", selected.email],
                ["Motivo", selected.reason ?? "Sin especificar"],
                ["Origen", selected.source],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-white/[.03] p-3" key={label}>
                  <dt className="text-xs uppercase text-zinc-600">{label}</dt>
                  <dd className="mt-1 break-words font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            {selected.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 p-4 text-sm text-zinc-400">
                {selected.notes}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                className="btn"
                href={`https://wa.me/${selected.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${selected.customerName}, te contactamos por tu reserva ${selected.reference} para el ${dateText(selected.reservationDate)} a las ${hourText(selected.reservationTime)}.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Preparar WhatsApp
              </a>
              <select
                className="input max-w-56"
                value={selected.status}
                onChange={(event) => changeStatus(selected, event.target.value as ReservationStatus)}
              >
                {reservationStatuses.map((option) => (
                  <option value={option} key={option}>
                    {reservationStatusLabel(option)}
                  </option>
                ))}
              </select>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
