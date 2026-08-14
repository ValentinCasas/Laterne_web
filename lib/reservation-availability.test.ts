import { describe, expect, it } from "vitest";
import {
  calculateReservationAvailability,
  type ReservationAvailabilitySettings,
} from "@/lib/reservation-availability";

const settings: ReservationAvailabilitySettings = {
  enabled: true,
  capacityPerSlot: 10,
  minimumLeadMinutes: 30,
  maximumAdvanceDays: 60,
  maximumPartySize: 10,
  sectors: ["Salón"],
  policy: null,
  confirmationMode: "manual",
  defaultDuration: 120,
};

const friday = {
  dayOfWeek: "Viernes",
  morningStartTime: null,
  morningEndTime: null,
  eveningStartTime: "19:00",
  eveningEndTime: "22:00",
};

function availability(
  reservations: Array<{ date: string; time: string; partySize: number; status: string }> = [],
  overrides: Partial<Parameters<typeof calculateReservationAvailability>[0]> = {},
) {
  return calculateReservationAvailability({
    date: "2026-08-14",
    partySize: 2,
    timeZone: "America/Argentina/Buenos_Aires",
    now: new Date("2026-08-14T19:00:00.000Z"), // 16:00 local
    settings,
    openings: [friday],
    blocks: [],
    reservations,
    ...overrides,
  });
}

describe("disponibilidad centralizada de reservas", () => {
  it("muestra todos los slots válidos de un día vacío cada 30 minutos", () => {
    expect(availability().slots.map((slot) => slot.time)).toEqual([
      "19:00",
      "19:30",
      "20:00",
      "20:30",
      "21:00",
      "21:30",
    ]);
  });

  it("una pending sólo marca su horario y conserva capacidad parcial", () => {
    const result = availability([
      { date: "2026-08-14", time: "20:00", partySize: 3, status: "pending" },
    ]);
    expect(result.slots.find((slot) => slot.time === "20:00")).toMatchObject({
      status: "pending",
      remaining: 7,
      pending: 3,
    });
    expect(result.slots.find((slot) => slot.time === "20:30")?.status).toBe("available");
  });

  it("una confirmed consume sólo la capacidad de su franja", () => {
    const result = availability([
      { date: "2026-08-14", time: "20:00", partySize: 9, status: "confirmed" },
    ]);
    expect(result.slots.find((slot) => slot.time === "20:00")).toMatchObject({
      status: "full",
      remaining: 1,
    });
    expect(result.hasAvailability).toBe(true);
  });

  it("recién considera lleno el día cuando todas sus franjas carecen de capacidad", () => {
    const reservations = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"].map((time) => ({
      date: "2026-08-14",
      time,
      partySize: 10,
      status: "confirmed",
    }));
    expect(availability(reservations).hasAvailability).toBe(false);
  });

  it("para hoy oculta pasado, respeta anticipación y redondea al próximo slot", () => {
    const result = availability([], { now: new Date("2026-08-14T23:10:00.000Z") }); // 20:10 local
    expect(result.slots[0]?.time).toBe("21:00");
    expect(result.slots.some((slot) => slot.time === "20:30")).toBe(false);
  });

  it("alinea horarios heredados con minutos arbitrarios y respeta bloqueos", () => {
    const result = availability([], {
      openings: [{ ...friday, eveningStartTime: "19:07" }],
      blocks: [{ startDate: "2026-08-14", endDate: "2026-08-14", startTime: "20:00", endTime: "20:30" }],
    });
    expect(result.slots.map((slot) => slot.time)).toEqual(["19:30", "21:00", "21:30"]);
  });
});
