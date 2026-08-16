import { describe, expect, it } from "vitest";
import { availableOrderSlots, isAvailableOrderSlot, orderLocalDateTime } from "@/lib/order-scheduling";

const friday = {
  dayOfWeek: "Viernes",
  morningStartTime: null,
  morningEndTime: null,
  eveningStartTime: "18:00",
  eveningEndTime: "00:00",
};

describe("order scheduling", () => {
  it("ofrece hoy desde la primera franja que respeta la anticipación", () => {
    const slots = availableOrderSlots({
      hours: [friday],
      timeZone: "America/Argentina/Buenos_Aires",
      now: new Date("2026-08-14T21:00:00.000Z"), // viernes 18:00
      leadMinutes: 30,
      days: 1,
    });
    expect(slots[0]).toMatchObject({ date: "2026-08-14", time: "18:30" });
    expect(slots.some((slot) => slot.time === "18:00")).toBe(false);
  });

  it("convierte la hora local usando la zona del tenant", () => {
    expect(orderLocalDateTime("2026-08-14", "20:00", "America/Argentina/Buenos_Aires").toISOString()).toBe(
      "2026-08-14T23:00:00.000Z",
    );
  });

  it("rechaza instantes que no pertenecen a una franja publicada", () => {
    const slots = availableOrderSlots({
      hours: [friday],
      timeZone: "America/Argentina/Buenos_Aires",
      now: new Date("2026-08-14T20:00:00.000Z"),
      days: 1,
    });
    expect(isAvailableOrderSlot(new Date("2026-08-14T22:30:00.000Z"), slots)).toBe(true);
    expect(isAvailableOrderSlot(new Date("2026-08-14T22:45:00.000Z"), slots)).toBe(false);
  });

  it("alinea configuraciones heredadas a intervalos cómodos de media hora", () => {
    const slots = availableOrderSlots({
      hours: [{ ...friday, eveningStartTime: "18:07" }],
      timeZone: "America/Argentina/Buenos_Aires",
      now: new Date("2026-08-14T19:00:00.000Z"),
      days: 1,
    });
    expect(slots[0]).toMatchObject({ date: "2026-08-14", time: "18:30" });
  });
});
