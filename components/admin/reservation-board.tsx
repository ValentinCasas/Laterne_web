"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";
import {
  defaultReservationTimeZone,
  reservationStatuses,
  reservationStatusLabel,
  type ReservationStatus,
} from "@/lib/reservations";

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

/** @summary Desplaza una fecha AAAA-MM-DD una cantidad de días sin depender de la zona del navegador. */
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** @summary Separa una fecha AAAA-MM-DD en sus componentes. */
function parseISO(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month: month - 1, day };
}

/** @summary Compone una fecha AAAA-MM-DD a partir de componentes, con mes en base 0. */
function toISO(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** @summary Desplaza una fecha una cantidad de meses, sin salirse del mes destino. */
function addMonthsISO(date: string, months: number) {
  const { year, month, day } = parseISO(date);
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return toISO(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay));
}

/** @summary Devuelve el lunes de la semana (inicio domingo 0) que contiene la fecha. */
function mondayOf(date: string) {
  const { year, month, day } = parseISO(date);
  const weekday = new Date(Date.UTC(year, month, day)).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

/** @summary Día de la semana y número para encabezados compactos del calendario. */
function weekdayShort(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", { weekday: "short" });
}

/** @summary Fecha corta como “12 jun” para rangos y navegación del calendario. */
function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type BoardView = "list" | "calendar";
type CalendarMode = "day" | "week" | "month";

const calendarModeLabels: Record<CalendarMode, string> = {
  day: "Día",
  week: "Semana",
  month: "Mes",
};

/** @summary Nombre de una fecha para encabezados, resaltando hoy y mañana. */
function dateLabel(date: string, today: string) {
  if (date === today) return "Hoy";
  if (date === addDays(today, 1)) return "Mañana";
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

type BoardTab = "upcoming" | "today" | "past" | "all";
type DateRange = "all" | "today" | "tomorrow" | "week";

const tabLabels: Record<BoardTab, string> = {
  upcoming: "Próximas",
  today: "Hoy",
  past: "Pasadas",
  all: "Todas",
};

const rangeLabels: Record<DateRange, string> = {
  all: "Todas las próximas",
  today: "Hoy",
  tomorrow: "Mañana",
  week: "Próximos 7 días",
};

/** @summary Organiza reservas, vistas temporales, estados, capacidad y bloqueos del negocio. */
export function ReservationBoard({
  initialReservations,
  initialSettings,
  initialBlocks,
  today,
  timeZone,
}: {
  initialReservations: ReservationItem[];
  initialSettings: ReservationSettingsData;
  initialBlocks: ReservationBlockData[];
  today: string;
  timeZone?: string;
}) {
  const [reservations, setReservations] = useState(initialReservations);
  const [settings, setSettings] = useState(initialSettings);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [tab, setTab] = useState<BoardTab>("upcoming");
  const [range, setRange] = useState<DateRange>("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReservationItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<BoardView>("list");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [anchor, setAnchor] = useState(today);
  const [dragId, setDragId] = useState<number | null>(null);

  const visibleReservations = useMemo(() => {
    const day = (reservation: ReservationItem) => dateText(reservation.reservationDate);
    const key = (reservation: ReservationItem) =>
      `${day(reservation)} ${hourText(reservation.reservationTime)}`;
    const ascending = (first: ReservationItem, second: ReservationItem) =>
      key(first).localeCompare(key(second));
    const descending = (first: ReservationItem, second: ReservationItem) =>
      key(second).localeCompare(key(first));

    let ordered: ReservationItem[];
    if (tab === "today") {
      ordered = reservations.filter((item) => day(item) === today).sort(ascending);
    } else if (tab === "upcoming") {
      ordered = reservations.filter((item) => day(item) >= today).sort(ascending);
      if (range === "today") ordered = ordered.filter((item) => day(item) === today);
      if (range === "tomorrow") ordered = ordered.filter((item) => day(item) === addDays(today, 1));
      if (range === "week") ordered = ordered.filter((item) => day(item) <= addDays(today, 6));
    } else if (tab === "past") {
      ordered = reservations.filter((item) => day(item) < today).sort(descending);
    } else {
      ordered = [...reservations].sort(descending);
    }

    const normalizedQuery = query.trim().toLocaleLowerCase("es");
    return ordered.filter((reservation) => {
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
    });
  }, [query, range, reservations, status, tab, today]);

  const groupedReservations = useMemo(() => {
    const groups = new Map<string, ReservationItem[]>();
    for (const reservation of visibleReservations) {
      const date = dateText(reservation.reservationDate);
      groups.set(date, [...(groups.get(date) ?? []), reservation]);
    }
    return [...groups.entries()];
  }, [visibleReservations]);

  const counts = useMemo(
    () => ({
      upcoming: reservations.filter((item) => dateText(item.reservationDate) >= today).length,
      today: reservations.filter((item) => dateText(item.reservationDate) === today).length,
      pending: reservations.filter((item) => item.status === "pending").length,
    }),
    [reservations, today],
  );

  /** @summary Reservas del calendario, respetando el filtro de estado pero sin las vistas de lista. */
  const calendarReservations = useMemo(() => {
    if (status === "all") return reservations;
    return reservations.filter((item) => item.status === status);
  }, [reservations, status]);

  /** @summary Mapa fecha → reservas usado por las tres vistas del calendario. */
  const reservationsByDay = useMemo(() => {
    const map = new Map<string, ReservationItem[]>();
    for (const reservation of calendarReservations) {
      const date = dateText(reservation.reservationDate);
      map.set(date, [...(map.get(date) ?? []), reservation]);
    }
    return map;
  }, [calendarReservations]);

  const weekDates = useMemo(() => {
    const monday = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }, [anchor]);

  const monthCells = useMemo(() => {
    const { year, month } = parseISO(anchor);
    const start = mondayOf(toISO(year, month, 1));
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [anchor]);

  const calendarTitle = (() => {
    if (calendarMode === "day") return dateLabel(anchor, today);
    if (calendarMode === "week") return `${shortDate(weekDates[0])} – ${shortDate(weekDates[6])}`;
    const { year, month } = parseISO(anchor);
    return `${monthNames[month]} ${year}`;
  })();

  /** @summary Mueve el ancla del calendario según la vista activa. */
  function shiftAnchor(direction: number) {
    if (calendarMode === "day") setAnchor((current) => addDays(current, direction));
    else if (calendarMode === "week") setAnchor((current) => addDays(current, 7 * direction));
    else setAnchor((current) => addMonthsISO(current, direction));
  }

  const hasRefinements = query.trim() !== "" || status !== "all";
  const filtersActive = hasRefinements || range !== "all";

  /** @summary Vuelve al estado inicial de la vista para que las nuevas reservas queden visibles. */
  function clearFilters() {
    setQuery("");
    setStatus("all");
    setTab("upcoming");
    setRange("all");
  }

  /** @summary Actualiza una reserva y sincroniza su estado en la lista y el detalle. */
  async function changeStatus(reservation: ReservationItem, nextStatus: ReservationStatus) {
    const response = await scopedFetch(`/api/admin/reservations/${reservation.id}`, {
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

  /** @summary Persiste fecha y/o hora de una reserva tras un drag & drop o edición. */
  async function moveReservation(
    reservation: ReservationItem,
    next: { reservationDate?: string; reservationTime?: string },
  ) {
    const confirmation = await Swal.fire({
      title: "¿Mover la reserva?",
      text: `${reservation.customerName} · ${reservation.reference} → ${
        next.reservationDate ? `${next.reservationDate} ` : ""
      }${next.reservationTime ? `a las ${next.reservationTime}` : "mismo horario"}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Mover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
    const body = (await response.json()) as { reservation?: ReservationItem; error?: string };
    if (!response.ok || !body.reservation) {
      await Swal.fire({
        title: "No se pudo mover",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
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
    await Swal.fire({
      title: "Reserva actualizada",
      icon: "success",
      timer: 1100,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
  }

  /** @summary Guarda los datos editables de una reserva desde el detalle. */
  async function updateDetails(reservation: ReservationItem, next: {
    reservationDate: string;
    reservationTime: string;
    partySize: number;
    sector: string;
    notes: string;
  }) {
    const response = await scopedFetch(`/api/admin/reservations/${reservation.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reservationDate: next.reservationDate,
        reservationTime: next.reservationTime,
        partySize: next.partySize,
        sector: next.sector.trim() || null,
        notes: next.notes.trim() || null,
      }),
    });
    const body = (await response.json()) as { reservation?: ReservationItem; error?: string };
    if (!response.ok || !body.reservation) {
      await Swal.fire({
        title: "No se pudieron guardar los cambios",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return false;
    }
    setReservations((current) =>
      current.map((item) => (item.id === reservation.id ? { ...item, ...body.reservation } : item)),
    );
    setSelected((current) =>
      current?.id === reservation.id ? { ...current, ...body.reservation } : current,
    );
    await Swal.fire({
      title: "Reserva actualizada",
      icon: "success",
      timer: 1100,
      showConfirmButton: false,
      background: "#18181b",
      color: "#fafafa",
    });
    return true;
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
    const response = await scopedFetch("/api/admin/reservations/settings", {
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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    const response = await scopedFetch("/api/admin/reservations/blocks", {
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
    formElement.reset();
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
    const response = await scopedFetch(`/api/admin/reservations/blocks/${block.id}`, { method: "DELETE" });
    if (response.ok) setBlocks((current) => current.filter((item) => item.id !== block.id));
  }

  const selectedDayLabel = selected ? dateLabel(dateText(selected.reservationDate), today) : "";
  const todayFormatted = new Intl.DateTimeFormat("es-AR", {
    timeZone: timeZone ?? defaultReservationTimeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${today}T12:00:00Z`));

  return (
    <section>
      <AdminPageHeader
        eyebrow="Operación de salón"
        title="Reservas"
        description="Capacidad, confirmaciones, bloqueos y próximos visitantes."
        section="reservas"
        actions={
          <button className="btn" onClick={() => setSettingsOpen((current) => !current)} type="button">
            {settingsOpen ? "Cerrar configuración" : "Configurar reservas"}
          </button>
        }
      >
        <p className="mt-2 text-xs text-zinc-600">Hoy · {todayFormatted}</p>
      </AdminPageHeader>

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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl bg-white/5 p-1">
          {(["list", "calendar"] as const).map((option) => (
            <button
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${view === option ? "bg-pink-500" : "text-zinc-500 hover:text-zinc-300"}`}
              key={option}
              onClick={() => setView(option)}
              type="button"
            >
              {option === "list" ? "Lista" : "Calendario"}
            </button>
          ))}
        </div>
        {view === "calendar" && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-white/5 p-1">
              {(["day", "week", "month"] as const).map((mode) => (
                <button
                  className={`rounded-lg px-3 py-2 text-sm font-bold transition ${calendarMode === mode ? "bg-pink-500" : "text-zinc-500 hover:text-zinc-300"}`}
                  key={mode}
                  onClick={() => setCalendarMode(mode)}
                  type="button"
                >
                  {calendarModeLabels[mode]}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950 px-2 py-1.5">
              <button
                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
                onClick={() => shiftAnchor(-1)}
                type="button"
                aria-label="Anterior"
              >
                ‹
              </button>
              <button
                className="rounded-lg px-2 py-1 text-xs font-bold text-pink-300 hover:bg-pink-500/10"
                onClick={() => setAnchor(today)}
                type="button"
              >
                Hoy
              </button>
              <span className="min-w-36 text-center text-sm font-black">{calendarTitle}</span>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white"
                onClick={() => shiftAnchor(1)}
                type="button"
                aria-label="Siguiente"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {view === "calendar" ? (
        <div className="mt-5">
          {calendarMode === "day" && (
            <DayCalendar
              date={anchor}
              items={reservationsByDay.get(anchor) ?? []}
              today={today}
              onSelect={setSelected}
              onMove={moveReservation}
              dragId={dragId}
              setDragId={setDragId}
            />
          )}
          {calendarMode === "week" && (
            <WeekCalendar
              dates={weekDates}
              byDay={reservationsByDay}
              today={today}
              onSelect={setSelected}
              onMove={moveReservation}
              dragId={dragId}
              setDragId={setDragId}
            />
          )}
          {calendarMode === "month" && (
            <MonthCalendar
              cells={monthCells}
              byDay={reservationsByDay}
              today={today}
              onSelect={setSelected}
              onMove={moveReservation}
              dragId={dragId}
              setDragId={setDragId}
            />
          )}
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 rounded-2xl border border-white/10 bg-zinc-950 p-3 md:grid-cols-[auto_1fr_auto_auto]">
            <div className="flex rounded-xl bg-white/5 p-1">
              {(["upcoming", "today", "past", "all"] as const).map((option) => (
                <button
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${tab === option ? "bg-pink-500" : "text-zinc-500"}`}
                  key={option}
                  onClick={() => setTab(option)}
                  type="button"
                >
                  {tabLabels[option]}
                </button>
              ))}
            </div>
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
            {filtersActive && (
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 hover:border-pink-500/40 hover:text-white"
                onClick={clearFilters}
                type="button"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {tab === "upcoming" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", "today", "tomorrow", "week"] as const).map((option) => (
                <button
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    range === option
                      ? "bg-pink-500/15 text-pink-300 ring-1 ring-pink-500/40"
                      : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                  }`}
                  key={option}
                  onClick={() => setRange(option)}
                  type="button"
                >
                  {rangeLabels[option]}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">
              {counts.upcoming} próximas
            </span>
            <span className="rounded-full border border-white/10 bg-zinc-950 px-3 py-1 text-xs font-bold text-zinc-300">
              {counts.today} hoy
            </span>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
              {counts.pending} pendientes
            </span>
          </div>

          <div className="mt-5 max-h-[720px] space-y-5 overflow-y-auto pr-1">
            {groupedReservations.map(([date, items]) => (
              <section className="rounded-3xl border border-white/10 bg-zinc-950/70 p-4" key={date}>
                <header className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-black">{dateLabel(date, today)}</h2>
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
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-2xl font-black tabular-nums">
                            {hourText(reservation.reservationTime)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${statusColors[reservation.status]}`}
                          >
                            {reservationStatusLabel(reservation.status)}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-zinc-400">
                        {reservation.partySize} {reservation.partySize === 1 ? "persona" : "personas"}
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
              <div className="rounded-3xl border border-dashed border-white/15 p-12 text-center">
                {hasRefinements ? (
                  <>
                    <p className="font-bold text-zinc-400">No hay reservas que coincidan con estos filtros.</p>
                    <button className="btn btn-secondary mt-4" onClick={clearFilters} type="button">
                      Limpiar filtros
                    </button>
                  </>
                ) : (
                  <p className="text-zinc-500">
                    {tab === "upcoming" &&
                      "No hay reservas próximas todavía. Cuando un cliente reserve desde la web, aparecerá acá."}
                    {tab === "today" && "No hay reservas para hoy todavía."}
                    {tab === "past" && "Todavía no hay reservas pasadas."}
                    {tab === "all" && "Todavía no hay reservas registradas."}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

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
                [
                  "Fecha",
                  `${dateText(selected.reservationDate)}${
                    selectedDayLabel === "Hoy" || selectedDayLabel === "Mañana"
                      ? ` · ${selectedDayLabel}`
                      : ""
                  }`,
                ],
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
            <ReservationEditForm
              key={selected.id}
              reservation={selected}
              maximumPartySize={settings.maximumPartySize}
              onSave={(next) => updateDetails(selected, next)}
            />
            {selected.notes && (
              <p className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 p-4 text-sm text-zinc-400">
                {selected.notes}
              </p>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                className="btn"
                href={`https://wa.me/${selected.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${selected.customerName}, te contactamos por tu reserva ${selected.reference} para el ${dateText(selected.reservationDate)} a las ${hourText(selected.reservationTime)}.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Preparar WhatsApp
              </a>
              {selected.status !== "confirmed" && (
                <button
                  className="btn btn-secondary"
                  onClick={() => changeStatus(selected, "confirmed")}
                  type="button"
                >
                  Confirmar
                </button>
              )}
              {selected.status !== "completed" && (
                <button
                  className="btn btn-secondary"
                  onClick={() => changeStatus(selected, "completed")}
                  type="button"
                >
                  Marcar completada
                </button>
              )}
              {selected.status !== "cancelled" && (
                <button
                  className="btn btn-secondary"
                  onClick={() => changeStatus(selected, "cancelled")}
                  type="button"
                >
                  Cancelar
                </button>
              )}
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

/** @summary Formulario para ajustar fecha, hora, personas y sector de una reserva desde el detalle. */
function ReservationEditForm({
  reservation,
  maximumPartySize,
  onSave,
}: {
  reservation: ReservationItem;
  maximumPartySize: number;
  onSave: (next: {
    reservationDate: string;
    reservationTime: string;
    partySize: number;
    sector: string;
    notes: string;
  }) => Promise<boolean>;
}) {
  const [date, setDate] = useState(dateText(reservation.reservationDate));
  const [time, setTime] = useState(hourText(reservation.reservationTime));
  const [partySize, setPartySize] = useState(reservation.partySize);
  const [sector, setSector] = useState(reservation.sector ?? "");
  const [notes, setNotes] = useState(reservation.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    await onSave({ reservationDate: date, reservationTime: time, partySize, sector, notes });
    setSaving(false);
  }

  return (
    <form
      className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-4"
      onSubmit={submit}
    >
      <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500">Editar reserva</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Fecha
          <input className="input mt-1" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <label className="text-sm font-bold">
          Hora
          <input className="input mt-1" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
        </label>
        <label className="text-sm font-bold">
          Personas
          <input
            className="input mt-1"
            type="number"
            min={1}
            max={maximumPartySize || 500}
            value={partySize}
            onChange={(event) => setPartySize(Number(event.target.value))}
            required
          />
        </label>
        <label className="text-sm font-bold">
          Sector
          <input className="input mt-1" value={sector} maxLength={100} onChange={(event) => setSector(event.target.value)} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">
          Notas
          <textarea className="input mt-1 min-h-16" value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} />
        </label>
      </div>
      <button className="btn mt-4" disabled={saving} type="submit">
        {saving ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

/** @summary Vista de día: franjas horarias con cada reserva a su horario y movimiento por arrastre. */
function DayCalendar({
  date,
  items,
  today,
  onSelect,
  onMove,
  dragId,
  setDragId,
}: {
  date: string;
  items: ReservationItem[];
  today: string;
  onSelect: (reservation: ReservationItem) => void;
  onMove: (reservation: ReservationItem, next: { reservationDate?: string; reservationTime?: string }) => Promise<void>;
  dragId: number | null;
  setDragId: (value: number | null) => void;
}) {
  const sorted = [...items].sort((first, second) =>
    hourText(first.reservationTime).localeCompare(hourText(second.reservationTime)),
  );
  const totalPeople = sorted.reduce((sum, item) => sum + item.partySize, 0);
  const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
  const byHour = (reservation: ReservationItem) => hourText(reservation.reservationTime).slice(0, 2);
  const dragged = items.find((item) => item.id === dragId) ?? null;

  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950/70 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black">{dateLabel(date, today)}</h2>
        <span className="text-sm text-zinc-500">
          {sorted.length} {sorted.length === 1 ? "reserva" : "reservas"} · {totalPeople} personas
        </span>
      </header>
      {dragId !== null && (
        <p className="mt-3 rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-2 text-sm text-pink-200">
          Arrastrá la reserva sobre la hora nueva para moverla.
        </p>
      )}
      <div className="mt-4 space-y-2">
        {hours.map((hour) => {
          const reservations = sorted.filter((item) => byHour(item) === hour);
          return (
            <div
              className={`grid items-center gap-2 rounded-2xl border px-3 py-1.5 transition sm:grid-cols-[4rem_1fr] ${
                dragId !== null ? "border-pink-500/20 bg-pink-500/[.03]" : "border-white/5"
              }`}
              key={hour}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragged) return;
                setDragId(null);
                void onMove(dragged, { reservationDate: date, reservationTime: `${hour}:${hourText(dragged.reservationTime).slice(3, 5)}` });
              }}
            >
              <span className="text-sm font-black tabular-nums text-zinc-500">{hour}:00</span>
              <div className="space-y-1.5">
                {reservations.map((reservation) => (
                  <button
                    className="grid w-full items-center gap-3 rounded-xl border border-white/10 bg-black p-2.5 text-left transition hover:border-pink-500/40 sm:grid-cols-[4.5rem_1fr_auto]"
                    draggable
                    key={reservation.id}
                    onClick={() => onSelect(reservation)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(reservation.id));
                      setDragId(reservation.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    type="button"
                  >
                    <span className="text-xl font-black tabular-nums text-pink-300">
                      {hourText(reservation.reservationTime)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-black">{reservation.customerName}</span>
                      <span className="block text-sm text-zinc-400">
                        {reservation.partySize} {reservation.partySize === 1 ? "persona" : "personas"}
                        {reservation.sector ? ` · ${reservation.sector}` : ""}
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${statusColors[reservation.status]}`}
                    >
                      {reservationStatusLabel(reservation.status)}
                    </span>
                  </button>
                ))}
                {!reservations.length && <p className="py-0.5 text-xs text-zinc-800">—</p>}
              </div>
            </div>
          );
        })}
        {!sorted.length && (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-zinc-600">
            No hay reservas para este día.
          </p>
        )}
      </div>
    </div>
  );
}

/** @summary Vista de semana: una columna por día con las reservas ordenadas por horario. */
function WeekCalendar({
  dates,
  byDay,
  today,
  onSelect,
  onMove,
  dragId,
  setDragId,
}: {
  dates: string[];
  byDay: Map<string, ReservationItem[]>;
  today: string;
  onSelect: (reservation: ReservationItem) => void;
  onMove: (reservation: ReservationItem, next: { reservationDate?: string; reservationTime?: string }) => Promise<void>;
  dragId: number | null;
  setDragId: (value: number | null) => void;
}) {
  const dragged = [...byDay.values()].flat().find((item) => item.id === dragId) ?? null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
      {dates.map((date) => {
        const items = [...(byDay.get(date) ?? [])].sort((first, second) =>
          hourText(first.reservationTime).localeCompare(hourText(second.reservationTime)),
        );
        const isToday = date === today;
        return (
          <section
            className={`min-w-0 rounded-2xl border p-3 ${
              isToday ? "border-pink-500/40 bg-pink-500/[.04]" : "border-white/10 bg-zinc-950/70"
            } ${dragId !== null ? "ring-1 ring-pink-500/20" : ""}`}
            key={date}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!dragged) return;
              setDragId(null);
              void onMove(dragged, { reservationDate: date });
            }}
          >
            <header>
              <p className={`text-[10px] font-black uppercase ${isToday ? "text-pink-300" : "text-zinc-500"}`}>
                {weekdayShort(date)}
              </p>
              <p className={`text-xl font-black ${isToday ? "text-white" : "text-zinc-300"}`}>
                {Number(date.slice(8, 10))}
              </p>
            </header>
            <div className="mt-3 space-y-2">
              {items.map((reservation) => (
                <button
                  className="block w-full rounded-xl border border-white/10 bg-black p-2 text-left transition hover:border-pink-500/40"
                  draggable
                  key={reservation.id}
                  onClick={() => onSelect(reservation)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(reservation.id));
                    setDragId(reservation.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                  type="button"
                >
                  <p className="text-xs font-black tabular-nums text-pink-300">
                    {hourText(reservation.reservationTime)}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-bold">{reservation.customerName}</p>
                  <p className="text-[10px] text-zinc-500">
                    {reservation.partySize} {reservation.partySize === 1 ? "pax" : "pax"}
                    {reservation.sector ? ` · ${reservation.sector}` : ""}
                  </p>
                </button>
              ))}
              {!items.length && <p className="py-2 text-center text-xs text-zinc-700">Sin reservas</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** @summary Vista de mes: grilla de 6 semanas con hasta tres reservas por celda. */
function MonthCalendar({
  cells,
  byDay,
  today,
  onSelect,
  onMove,
  dragId,
  setDragId,
}: {
  cells: string[];
  byDay: Map<string, ReservationItem[]>;
  today: string;
  onSelect: (reservation: ReservationItem) => void;
  onMove: (reservation: ReservationItem, next: { reservationDate?: string; reservationTime?: string }) => Promise<void>;
  dragId: number | null;
  setDragId: (value: number | null) => void;
}) {
  const anchorMonth = cells[10].slice(0, 7);
  const dragged = [...byDay.values()].flat().find((item) => item.id === dragId) ?? null;
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70">
      <div className="grid grid-cols-7 border-b border-white/10 text-center text-[10px] font-black uppercase tracking-wider text-zinc-500">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div className="py-2" key={day}>
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date) => {
          const inMonth = date.slice(0, 7) === anchorMonth;
          const items = (byDay.get(date) ?? []).sort((first, second) =>
            hourText(first.reservationTime).localeCompare(hourText(second.reservationTime)),
          );
          const isToday = date === today;
          return (
            <div
              className={`min-h-24 border-b border-r border-white/5 p-1.5 ${inMonth ? "" : "opacity-30"} ${
                dragId !== null ? "bg-pink-500/[.03]" : ""
              }`}
              key={date}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!dragged) return;
                setDragId(null);
                void onMove(dragged, { reservationDate: date });
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    isToday ? "bg-pink-500 text-white" : "text-zinc-400"
                  }`}
                >
                  {Number(date.slice(8, 10))}
                </span>
                {items.length > 0 && (
                  <span className="text-[10px] font-bold text-pink-300">{items.length}</span>
                )}
              </div>
              <div className="mt-1 space-y-1">
                {items.slice(0, 3).map((reservation) => (
                  <button
                    className="block w-full truncate rounded-md bg-white/[.04] px-1.5 py-0.5 text-left text-[10px] font-bold hover:bg-white/10"
                    draggable
                    key={reservation.id}
                    onClick={() => onSelect(reservation)}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(reservation.id));
                      setDragId(reservation.id);
                    }}
                    onDragEnd={() => setDragId(null)}
                    type="button"
                    title={`${hourText(reservation.reservationTime)} · ${reservation.customerName} · ${reservation.partySize} personas`}
                  >
                    {hourText(reservation.reservationTime)} · {reservation.customerName}
                  </button>
                ))}
                {items.length > 3 && (
                  <p className="px-1 text-[10px] font-bold text-zinc-500">+{items.length - 3} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
