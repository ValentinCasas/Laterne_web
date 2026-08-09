"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/components/analytics/tracker";

type Availability = {
  slots: Array<{ time: string; remaining: number }>;
  sectors: string[];
  policy: string | null;
  maximumPartySize?: number;
  disabled?: boolean;
  error?: string;
};

/** @summary Gestiona la consulta de disponibilidad y el envío accesible de una reserva pública. */
export function ReservationForm({
  minimumDate,
  initialSectors,
  initialPolicy,
  initialMaximumPartySize,
}: {
  minimumDate: string;
  initialSectors: string[];
  initialPolicy: string;
  initialMaximumPartySize: number;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [availability, setAvailability] = useState<Availability>({
    slots: [],
    sectors: initialSectors,
    policy: initialPolicy,
    maximumPartySize: initialMaximumPartySize,
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<{ reference: string; status: string } | null>(null);

  useEffect(() => {
    if (!date) return;
    let active = true;

    fetch(`/api/reservations?date=${encodeURIComponent(date)}`)
      .then(async (response) => {
        const body = (await response.json()) as Availability;
        if (!response.ok) throw new Error(body.error ?? "No se pudo consultar disponibilidad");
        if (active) setAvailability(body);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "No se pudo consultar disponibilidad");
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => {
      active = false;
    };
  }, [date]);

  /** @summary Actualiza la fecha elegida y descarta un horario perteneciente a la consulta anterior. */
  function changeDate(value: string) {
    setDate(value);
    setTime("");
    setError("");
    setLoadingSlots(Boolean(value));
    setAvailability((current) => ({ ...current, slots: [] }));
  }

  /** @summary Envía la solicitud al servidor y presenta su referencia de seguimiento. */
  async function submitReservation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    trackEvent("reservation.started");
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: form.get("customerName"),
      phone: form.get("phone"),
      email: form.get("email"),
      date,
      time,
      partySize: Number(form.get("partySize")),
      sector: form.get("sector") || undefined,
      reason: form.get("reason") || undefined,
      notes: form.get("notes") || undefined,
      acceptedPolicy: form.get("acceptedPolicy") === "on",
      website: form.get("website"),
    };

    try {
      const response = await fetch("/api/reservations", {
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
      <section
        className="rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-7 sm:p-10"
        role="status"
      >
        <p className="section-eyebrow text-emerald-300">Solicitud recibida</p>
        <h2 className="mt-2 text-4xl font-black">Tu referencia es {confirmation.reference}</h2>
        <p className="mt-4 max-w-xl leading-relaxed text-emerald-100/70">
          {confirmation.status === "confirmed"
            ? "La reserva quedó confirmada automáticamente. Guardá esta referencia."
            : "La reserva quedó pendiente. El negocio confirmará la disponibilidad por los datos de contacto indicados."}
        </p>
        <button className="btn mt-6" onClick={() => setConfirmation(null)} type="button">
          Realizar otra reserva
        </button>
      </section>
    );
  }

  return (
    <form
      className="grid gap-5 rounded-[2rem] border border-white/10 bg-zinc-950 p-5 sm:grid-cols-2 sm:p-8"
      onSubmit={submitReservation}
    >
      <label className="hidden" aria-hidden="true">
        Sitio web
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <label className="text-sm font-bold">
        Fecha
        <input
          className="input mt-2"
          type="date"
          min={minimumDate}
          value={date}
          onChange={(event) => changeDate(event.target.value)}
          required
        />
      </label>
      <fieldset>
        <legend className="text-sm font-bold">Horario</legend>
        <div className="mt-2 min-h-12 rounded-xl border border-white/10 p-2">
          {loadingSlots ? (
            <p className="p-2 text-sm text-zinc-500">Consultando horarios…</p>
          ) : availability.slots.length ? (
            <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
              {availability.slots.map((slot) => (
                <button
                  className={`rounded-lg px-3 py-2 text-sm font-bold ${time === slot.time ? "bg-pink-500" : "bg-white/5 hover:bg-white/10"}`}
                  key={slot.time}
                  onClick={() => setTime(slot.time)}
                  type="button"
                  aria-pressed={time === slot.time}
                  title={`${slot.remaining} lugares disponibles`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          ) : (
            <p className="p-2 text-sm text-zinc-500">
              {date ? "No hay horarios disponibles para esa fecha." : "Elegí primero una fecha."}
            </p>
          )}
        </div>
      </fieldset>
      <label className="text-sm font-bold">
        Cantidad de personas
        <input
          className="input mt-2"
          name="partySize"
          type="number"
          min={1}
          max={availability.maximumPartySize ?? initialMaximumPartySize}
          required
        />
      </label>
      <label className="text-sm font-bold">
        Sector o preferencia
        <select className="input mt-2" name="sector">
          <option value="">Sin preferencia</option>
          {availability.sectors.map((sector) => (
            <option value={sector} key={sector}>
              {sector}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-bold">
        Nombre
        <input className="input mt-2" name="customerName" autoComplete="name" required />
      </label>
      <label className="text-sm font-bold">
        Teléfono
        <input className="input mt-2" name="phone" type="tel" autoComplete="tel" required />
      </label>
      <label className="text-sm font-bold">
        Email
        <input className="input mt-2" name="email" type="email" autoComplete="email" required />
      </label>
      <label className="text-sm font-bold">
        Motivo
        <select className="input mt-2" name="reason">
          <option value="">Encuentro general</option>
          <option>Cumpleaños</option>
          <option>Reunión</option>
          <option>Cena especial</option>
          <option>Evento empresarial</option>
        </select>
      </label>
      <label className="text-sm font-bold sm:col-span-2">
        Observaciones
        <textarea className="input mt-2 min-h-28" name="notes" maxLength={1500} />
      </label>
      <label className="flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm sm:col-span-2">
        <input className="mt-1 h-5 w-5 accent-pink-500" name="acceptedPolicy" type="checkbox" required />
        <span>
          Acepto la política de reservas.
          <small className="mt-1 block leading-relaxed text-zinc-500">
            {availability.policy ?? initialPolicy}
          </small>
        </span>
      </label>
      {error && (
        <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300 sm:col-span-2" role="alert">
          {error}
        </p>
      )}
      <button className="btn min-h-12 sm:col-span-2" disabled={submitting || !time || availability.disabled}>
        {submitting ? "Registrando…" : "Solicitar reserva"}
      </button>
    </form>
  );
}
