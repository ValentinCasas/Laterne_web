import { describe, expect, it } from "vitest";
import {
  deriveSessionStatus,
  isOpenTableOrder,
  isTableSessionStatus,
  tableStatusLabel,
  tableStatusOrder,
  tableStatusStyle,
  tableSessionStatuses,
} from "@/lib/table-status";

describe("estados del salón", () => {
  it("traduce estados a etiquetas claras", () => {
    expect(tableStatusLabel("free")).toBe("Libre");
    expect(tableStatusLabel("occupied")).toBe("Ocupada");
    expect(tableStatusLabel("awaiting_order")).toBe("Esperando pedido");
    expect(tableStatusLabel("preparing")).toBe("Preparando");
    expect(tableStatusLabel("ready_to_bill")).toBe("Lista para cobrar");
    expect(tableStatusLabel("reserved")).toBe("Reservada");
    expect(tableStatusLabel("desconocido")).toBe("desconocido");
  });

  it("reconoce solo estados de sesión válidos", () => {
    expect(isTableSessionStatus("occupied")).toBe(true);
    expect(isTableSessionStatus("awaiting_order")).toBe(true);
    expect(isTableSessionStatus("free")).toBe(false);
    expect(isTableSessionStatus("cualquiera")).toBe(false);
    expect(tableSessionStatuses).toHaveLength(5);
  });

  it("considera entregado/cancelado como pedidos cerrados de la mesa", () => {
    expect(isOpenTableOrder("received")).toBe(true);
    expect(isOpenTableOrder("preparing")).toBe(true);
    expect(isOpenTableOrder("delivered")).toBe(false);
    expect(isOpenTableOrder("cancelled")).toBe(false);
  });

  it("deriva ocupada cuando todavía no hay pedidos", () => {
    expect(deriveSessionStatus([])).toBe("occupied");
  });

  it("deriva esperando pedido con comandas recibidas", () => {
    expect(deriveSessionStatus(["received"])).toBe("awaiting_order");
    expect(deriveSessionStatus(["received", "confirmed"])).toBe("awaiting_order");
  });

  it("deriva preparando cuando la cocina trabaja", () => {
    expect(deriveSessionStatus(["preparing"])).toBe("preparing");
    expect(deriveSessionStatus(["ready"])).toBe("preparing");
    expect(deriveSessionStatus(["received", "preparing"])).toBe("preparing");
    expect(deriveSessionStatus(["on_the_way"])).toBe("preparing");
  });

  it("deriva lista para cobrar cuando todo está servido", () => {
    expect(deriveSessionStatus(["delivered"])).toBe("ready_to_bill");
    expect(deriveSessionStatus(["delivered", "cancelled"])).toBe("ready_to_bill");
    expect(deriveSessionStatus(["delivered", "received"])).toBe("awaiting_order");
  });

  it("expone estilos y orden de presentación estables", () => {
    expect(tableStatusStyle("free").dot).toBe("bg-emerald-400");
    expect(tableStatusStyle(null)).toBe(tableStatusStyle("free"));
    expect(tableStatusOrder[0]).toBe("free");
    expect(tableStatusOrder).toContain("ready_to_bill");
  });
});
