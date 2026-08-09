import { describe, expect, it } from "vitest";
import { buildTimeSlots, reservationStatusLabel, reservationTime, timeText } from "@/lib/reservations";

describe("utilidades de reservas", () => {
  it("construye franjas regulares y admite cierres después de medianoche", () => {
    expect(buildTimeSlots("18:00", "20:00", 30)).toEqual(["18:00", "18:30", "19:00", "19:30"]);
    expect(buildTimeSlots("23:00", "01:00", 60)).toEqual(["23:00", "00:00"]);
  });

  it("convierte horarios entre formulario y base de datos", () => {
    expect(timeText(reservationTime("21:30"))).toBe("21:30");
    expect(() => reservationTime("29:99")).toThrow(/horario/i);
  });

  it("presenta etiquetas humanas para cada estado", () => {
    expect(reservationStatusLabel("confirmed")).toBe("Confirmada");
    expect(reservationStatusLabel("no_show")).toBe("Ausente");
  });
});
