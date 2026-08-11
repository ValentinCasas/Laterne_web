import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  asOrderType,
  canTransition,
  orderFlow,
  transitionError,
} from "@/lib/order-status";

describe("máquina de estados de pedidos", () => {
  it("avanza por pasos en retiro y mesa", () => {
    expect(canTransition("received", "confirmed", "takeaway")).toBe(true);
    expect(canTransition("confirmed", "preparing", "takeaway")).toBe(true);
    expect(canTransition("preparing", "ready", "dine_in")).toBe(true);
    expect(canTransition("ready", "delivered", "takeaway")).toBe(true);
  });

  it("no permite saltos accidentales ni retrocesos", () => {
    expect(canTransition("received", "delivered", "takeaway")).toBe(false);
    expect(canTransition("received", "preparing", "takeaway")).toBe(false);
    expect(canTransition("delivered", "received", "takeaway")).toBe(false);
    expect(canTransition("received", "received", "takeaway")).toBe(false);
  });

  it("solo usa 'En camino' para delivery", () => {
    expect(canTransition("ready", "on_the_way", "delivery")).toBe(true);
    expect(canTransition("on_the_way", "delivered", "delivery")).toBe(true);
    expect(canTransition("ready", "on_the_way", "takeaway")).toBe(false);
    expect(canTransition("ready", "on_the_way", "dine_in")).toBe(false);
  });

  it("permite cancelar desde cualquier estado activo", () => {
    for (const status of ["received", "confirmed", "preparing", "ready", "on_the_way"]) {
      expect(canTransition(status as never, "cancelled", "delivery")).toBe(true);
    }
  });

  it("considera entregado y cancelado estados terminales", () => {
    expect(allowedTransitions("delivered", "delivery")).toHaveLength(0);
    expect(allowedTransitions("cancelled", "delivery")).toHaveLength(0);
    expect(canTransition("delivered", "cancelled", "delivery")).toBe(false);
    expect(canTransition("cancelled", "delivered", "delivery")).toBe(false);
  });

  it("ofrece mensajes claros cuando la transición no es válida", () => {
    expect(transitionError("received", "confirmed", "takeaway")).toBeNull();
    expect(transitionError("received", "delivered", "takeaway")).toContain("Recibido");
    expect(transitionError("delivered", "received", "takeaway")).toContain("Entregado");
  });

  it("deriva el flujo público según la modalidad", () => {
    expect(orderFlow("takeaway")).toEqual(["received", "confirmed", "preparing", "ready", "delivered"]);
    expect(orderFlow("delivery")).toEqual([
      "received",
      "confirmed",
      "preparing",
      "ready",
      "on_the_way",
      "delivered",
    ]);
  });

  it("normaliza modalidades desconocidas", () => {
    expect(asOrderType("delivery")).toBe("delivery");
    expect(asOrderType("otra_cosa")).toBe("takeaway");
  });
});
