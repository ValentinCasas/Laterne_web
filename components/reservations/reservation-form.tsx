"use client";

import { useEffect, useMemo, useState } from "react";
import { trackEvent } from "@/components/analytics/tracker";
import { scopedFetch } from "@/lib/client-routing";

type SlotStatus = "available" | "pending" | "full";
type Slot = { time: string; remaining: number; pending: number; status: SlotStatus };
type Availability = {
  slots: Slot[];
  sectors: string[];
  policy: string | null;
  maximumPartySize?: number;
  disabled?: boolean;
  error?: string;
};

type Step = "datos" | "horario" | "confirmar";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "datos", label: "Tus datos" },
  { id: "horario", label: "Día y horario" },
  { id: "confirmar", label: "Confirmar" },
];

const REASON_OPTIONS = ["Encuentro general", "Cumpleaños", "Reunión", "Cena especial", "Evento empresarial"];

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** @summary Flujo en tres pasos: datos → día y horario → confirmar, con disponibilidad server-side. */
export function ReservationForm({
  minimumDate,
  initialSectors,
  initialPolicy,
  initialMaximumPartySize,
  initialMaximumAdvanceDays,
  businessName,
  branchSlug,
}: {
  minimumDate: string;
  initialSectors: string[];
  initialPolicy: string;
  initialMaximumPartySize: number;
  initialMaximumAdvanceDays: number;
  businessName: string;
  branchSlug?: string;
}) {
  const [step, setStep] = useState<Step>("datos");
  const [partySize, setPartySize] = useState(2);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [sector, setSector] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [availability, setAvailability] = useState<Availability>({
    slots: [],
    sectors: initialSectors,
    policy: initialPolicy,
    maximumPartySize: initialMaximumPartySize,
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{ reference: string; status: string } | null>(null);

  const maximumPartySize = availability.maximumPartySize ?? initialMaximumPartySize;
  const maximumDate = useMemo(
    () => toDateKey(addDays(new Date(), initialMaximumAdvanceDays)),
    [initialMaximumAdvanceDays],
  );

  useEffect(() => {
    if (!date || step !== "horario") return;
    let active = true;
    scopedFetch(
      `/api/reservations?date=${encodeURIComponent(date)}&partySize=${encodeURIComponent(partySize)}${branchSlug ? `&branch=${encodeURIComponent(branchSlug)}` : ""}`,
    )
      .then(async (response) => {
        const body = (await response.json()) as Availability;
        if (!response.ok) throw new Error(body.error ?? "No se pudo consultar disponibilidad");
        if (active) setAvailability(body);
      })
      .catch((reason: unknown) => {
        if (active) setSlotsError(reason instanceof Error ? reason.message : "No se pudo consultar disponibilidad");
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });
    return () => {
      active = false;
    };
  }, [branchSlug, date, partySize, step]);

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);

  function validateData(): string | null {
    if (!partySize || partySize < 1 || partySize > maximumPartySize) {
      return `Indicá cuántas personas serán (máx. ${maximumPartySize}).`;
    }
    if (customerName.trim().length < 2) return "Escribí tu nombre.";
    if (phone.trim().length < 6) return "Escribí un teléfono válido.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "Escribí un email válido.";
    if (!acceptedPolicy) return "Tenés que aceptar la política para continuar.";
    return null;
  }

  function continueToHorario() {
    const problem = validateData();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    trackEvent("reservation.started");
    setLoadingSlots(true);
    setSlotsError("");
    setStep("horario");
  }

  function backToDatos() {
    setError("");
    setStep("datos");
  }

  /** @summary Crea la reserva recién en este paso y presenta su referencia. */
  async function submitReservation() {
    if (!date || !time) return;
    setSubmitting(true);
    setError("");
    const payload = {
      customerName: customerName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      date,
      time,
      partySize,
      sector: sector.trim() || undefined,
      reason: reason || undefined,
      notes: notes.trim() || undefined,
      acceptedPolicy,
      website: "",
      branchSlug,
    };
    try {
      const response = await scopedFetch("/api/reservations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { reference?: string; status?: string; error?: string };
      if (!response.ok || !body.reference || !body.status) {
        throw new Error(body.error ?? "No se pudo registrar la reserva");
      }
      setConfirmation({ reference: body.reference, status: body.status });
      trackEvent("reservation.completed", { entityType: "reservation", metadata: { status: body.status } });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la reserva");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmation) {
    return (
      <section className="rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-7 sm:p-10" role="status">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-2xl text-emerald-300">
          ✓
        </div>
        <p className="section-eyebrow mt-5 text-emerald-300">Solicitud enviada</p>
        <h2 className="mt-2 text-4xl font-black">Referencia: {confirmation.reference}</h2>
        <div className="mt-4 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-100/80">
          <strong className="block text-amber-300">
            {confirmation.status === "confirmed" ? "CONFIRMADA" : "SOLICITADA ≠ CONFIRMADA"}
          </strong>
          {confirmation.status === "confirmed" ? (
            <span className="mt-1 block">
              El negocio confirmó automáticamente tu lugar. Guardá la referencia por las dudas.
            </span>
          ) : (
            <span className="mt-1 block">
              Tu reserva todavía está pendiente de confirmación del negocio. Te vamos a avisar cuando la
              confirmen o si necesitan algo.
            </span>
          )}
        </div>
        <button className="btn mt-6" onClick={() => setConfirmation(null)} type="button">
          Realizar otra reserva
        </button>
      </section>
    );
  }

  return (
    <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-5 sm:p-8">
      <ol className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Progreso de la reserva">
        {STEPS.map((entry, index) => {
          const reached = index <= stepIndex;
          return (
            <li className="flex items-center gap-2" key={entry.id}>
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-black ${
                  reached ? "bg-pink-500 text-white" : "border border-white/25 text-zinc-500"
                }`}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className={`text-sm font-bold ${reached ? "text-white" : "text-zinc-500"}`}>{entry.label}</span>
            </li>
          );
        })}
      </ol>

      {step === "datos" && (
        <div className="mt-7 space-y-5">
          <h2 className="text-2xl font-black">Tus datos</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-bold">
              Cantidad de personas
              <input
                className="input mt-2"
                type="number"
                min={1}
                max={maximumPartySize}
                value={partySize || ""}
                onChange={(event) => setPartySize(Math.max(1, Math.min(maximumPartySize, Number(event.target.value) || 1)))}
                required
              />
            </label>
            <label className="text-sm font-bold">
              Sector o preferencia
              <select className="input mt-2" value={sector} onChange={(event) => setSector(event.target.value)}>
                <option value="">Sin preferencia</option>
                {availability.sectors.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold">
              Nombre
              <input
                className="input mt-2"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label className="text-sm font-bold">
              Teléfono / WhatsApp
              <input
                className="input mt-2"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Email
              <input
                className="input mt-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Motivo
              <select className="input mt-2" value={reason} onChange={(event) => setReason(event.target.value)}>
                {REASON_OPTIONS.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-bold sm:col-span-2">
              Observaciones
              <textarea
                className="input mt-2 min-h-28"
                maxLength={1500}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Alergias, cuna para bebé, ocasión especial… (opcional)"
              />
            </label>
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm sm:col-span-2">
              <input
                className="mt-1 h-5 w-5 accent-pink-500"
                type="checkbox"
                checked={acceptedPolicy}
                onChange={(event) => setAcceptedPolicy(event.target.checked)}
                required
              />
              <span>
                Acepto la política de reservas.
                <small className="mt-1 block leading-relaxed text-zinc-500">
                  {availability.policy ?? initialPolicy}
                </small>
              </span>
            </label>
          </div>
          {error && (
            <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <button className="btn w-full sm:w-auto" onClick={continueToHorario} type="button">
            Continuar →
          </button>
        </div>
      )}

      {step === "horario" && (
        <div className="mt-7">
          <h2 className="text-2xl font-black">Día y horario</h2>
          <p className="mt-2 text-sm text-zinc-400">
            {partySize} {partySize === 1 ? "persona" : "personas"} · Elegí un día y luego un horario.
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-start">
            <PublicDateCalendar
              value={date}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onSelect={(key) => {
                setDate(key);
                setTime("");
                setLoadingSlots(true);
                setSlotsError("");
              }}
            />
            <div className="min-w-0">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Horarios</h3>
              <div className="mt-3 space-y-2">
                {!date ? (
                  <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-zinc-500">
                    Elegí un día en el calendario para ver los horarios disponibles.
                  </p>
                ) : loadingSlots ? (
                  <p className="rounded-xl border border-white/10 p-4 text-sm text-zinc-400">
                    Consultando horarios…
                  </p>
                ) : slotsError ? (
                  <p className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300" role="alert">
                    {slotsError}
                  </p>
                ) : availability.slots.length ? (
                  availability.slots.map((slot) => {
                    const meta =
                      slot.status === "full"
                        ? { label: "Completo", className: "border-white/5 bg-white/[.01] text-zinc-600" }
                        : slot.status === "pending"
                          ? { label: "Solicitudes pendientes", className: "border-amber-400/35 bg-amber-400/10 text-amber-200" }
                          : { label: "Disponible", className: "border-white/15 bg-white/[.03] text-white" };
                    const selected = time === slot.time;
                    return (
                      <button
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          selected ? "border-pink-500 bg-pink-500/15 text-white ring-1 ring-pink-500/40" : meta.className
                        } ${slot.status === "full" ? "cursor-not-allowed" : "hover:border-pink-500/50"}`}
                        disabled={slot.status === "full"}
                        key={slot.time}
                        onClick={() => setTime(slot.time)}
                        type="button"
                        aria-pressed={selected}
                        aria-disabled={slot.status === "full"}
                      >
                        <strong className="text-lg tabular-nums">{slot.time}</strong>
                        <span
                          className={`text-xs font-bold ${slot.status === "pending" && !selected ? "text-amber-300" : selected ? "text-pink-200" : slot.status === "full" ? "text-zinc-600" : "text-emerald-300"}`}
                        >
                          {meta.label}
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-zinc-500">
                    No hay horarios disponibles para ese día.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button className="btn btn-secondary" onClick={backToDatos} type="button">
              ← Volver
            </button>
            <button className="btn" disabled={!date || !time} onClick={() => setStep("confirmar")} type="button">
              Continuar →
            </button>
          </div>
        </div>
      )}

      {step === "confirmar" && (
        <div className="mt-7">
          <h2 className="text-2xl font-black">Revisá tu reserva</h2>
          <dl className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid gap-1 border-b border-white/10 bg-white/[.04] p-5">
              <dt className="sr-only">Negocio</dt>
              <dd className="text-lg font-black">{businessName}</dd>
            </div>
            <div className="grid grid-cols-2 gap-4 p-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-widest text-zinc-500">Día</dt>
                <dd className="mt-1 font-bold capitalize">
                  {date
                    ? new Date(`${date}T00:00:00`).toLocaleDateString("es-AR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-zinc-500">Horario</dt>
                <dd className="mt-1 font-bold tabular-nums">{time || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-zinc-500">Personas</dt>
                <dd className="mt-1 font-bold">{partySize}</dd>
              </div>
              {sector && (
                <div>
                  <dt className="text-xs uppercase tracking-widest text-zinc-500">Sector</dt>
                  <dd className="mt-1 font-bold">{sector}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs uppercase tracking-widest text-zinc-500">Nombre</dt>
                <dd className="mt-1 font-bold">{customerName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-widest text-zinc-500">Teléfono</dt>
                <dd className="mt-1 font-bold tabular-nums">{phone}</dd>
              </div>
            </div>
          </dl>
          {error && (
            <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button className="btn btn-secondary" onClick={() => setStep("horario")} type="button">
              ← Volver
            </button>
            <button className="btn" disabled={submitting} onClick={() => void submitReservation()} type="button">
              {submitting ? "Enviando…" : "Solicitar reserva"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** @summary Calendario público mensual accesible, con días deshabilitados fuera de la ventana permitida. */
function PublicDateCalendar({
  value,
  minimumDate,
  maximumDate,
  onSelect,
}: {
  value: string;
  minimumDate: string;
  maximumDate: string;
  onSelect: (key: string) => void;
}) {
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const [view, setView] = useState(() => {
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  const cells = useMemo(() => {
    const firstDay = new Date(view.year, view.month, 1).getDay();
    const startOffset = (firstDay + 6) % 7;
    const start = new Date(view.year, view.month, 1 - startOffset);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [view.month, view.year]);

  const canGoPrev = useMemo(() => {
    const lastOfPrev = new Date(view.year, view.month, 0);
    return toDateKey(lastOfPrev) >= minimumDate;
  }, [minimumDate, view.month, view.year]);
  const canGoNext = useMemo(() => {
    const firstOfNext = new Date(view.year, view.month + 1, 1);
    return toDateKey(firstOfNext) <= maximumDate;
  }, [maximumDate, view.month, view.year]);

  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[.02] p-4">
      <div className="flex items-center justify-between gap-2">
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm disabled:opacity-30"
          onClick={() => setView((current) => ({ year: current.month === 0 ? current.year - 1 : current.year, month: current.month === 0 ? 11 : current.month - 1 }))}
          disabled={!canGoPrev}
          type="button"
          aria-label="Mes anterior"
        >
          ←
        </button>
        <strong className="text-base capitalize">{monthLabel}</strong>
        <button
          className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm disabled:opacity-30"
          onClick={() => setView((current) => ({ year: current.month === 11 ? current.year + 1 : current.year, month: current.month === 11 ? 0 : current.month + 1 }))}
          disabled={!canGoNext}
          type="button"
          aria-label="Mes siguiente"
        >
          →
        </button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wider text-zinc-500">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          const key = toDateKey(cell);
          const inView = cell.getMonth() === view.month;
          const disabled = key < minimumDate || key > maximumDate;
          const selected = key === value;
          const today = key === todayKey;
          return (
            <button
              className={`aspect-square rounded-lg text-xs font-bold transition ${
                selected
                  ? "bg-pink-500 text-white"
                  : disabled
                    ? "cursor-not-allowed text-zinc-700"
                    : inView
                      ? "text-white hover:bg-pink-500/20"
                      : "text-zinc-700 hover:bg-white/5"
              } ${today && !selected && !disabled ? "ring-1 ring-pink-500/40" : ""}`}
              disabled={disabled}
              key={key}
              onClick={() => onSelect(key)}
              type="button"
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
