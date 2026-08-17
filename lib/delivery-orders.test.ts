import { describe, expect, it } from "vitest";
import {
  ACTIVE_DELIVERY_STATUSES,
  deliveryNumber,
  DELIVERY_ORDER_TYPES,
  ORDER_STATUSES_WITH_DELIVERY,
  requiresDelivery,
} from "@/lib/delivery-orders";
import { driverCoversBranch } from "@/lib/delivery-drivers";

describe("integración delivery: modalidad del pedido", () => {
  it("solo la modalidad delivery genera entrega automática", () => {
    expect(requiresDelivery("delivery")).toBe(true);
    expect(requiresDelivery("DELIVERY")).toBe(true);
    expect(requiresDelivery(" takeaway ")).toBe(false);
    expect(requiresDelivery("dine_in")).toBe(false);
    expect(requiresDelivery("retiro")).toBe(false);
    expect(requiresDelivery("MESA")).toBe(false);
    expect(requiresDelivery(null)).toBe(false);
    expect(requiresDelivery(undefined)).toBe(false);
    expect(requiresDelivery("")).toBe(false);
  });

  it("declara la modalidad delivery en el set de tipos que integran", () => {
    expect(DELIVERY_ORDER_TYPES.has("delivery")).toBe(true);
    expect(DELIVERY_ORDER_TYPES.size).toBe(1);
  });
});

describe("integración delivery: estados", () => {
  it("las entregas vigentes bloquean una segunda entrega", () => {
    for (const status of ["PENDING_ASSIGNMENT", "ASSIGNED", "PICKED_UP", "ON_THE_WAY", "INCIDENT"]) {
      expect(ACTIVE_DELIVERY_STATUSES.has(status)).toBe(true);
    }
    expect(ACTIVE_DELIVERY_STATUSES.has("DELIVERED")).toBe(false);
    expect(ACTIVE_DELIVERY_STATUSES.has("CANCELLED")).toBe(false);
    expect(ACTIVE_DELIVERY_STATUSES.has("FAILED")).toBe(false);
  });

  it("solo pedidos activos mantienen entrega en curso", () => {
    for (const status of ["received", "confirmed", "preparing", "ready", "on_the_way"]) {
      expect(ORDER_STATUSES_WITH_DELIVERY.has(status)).toBe(true);
    }
    expect(ORDER_STATUSES_WITH_DELIVERY.has("delivered")).toBe(false);
    expect(ORDER_STATUSES_WITH_DELIVERY.has("cancelled")).toBe(false);
  });
});

describe("integración delivery: número de remito", () => {
  it("genera números con prefijo ENT y sufijo único", () => {
    const first = deliveryNumber();
    const second = deliveryNumber();
    expect(first).toMatch(/^ENT-[A-Z0-9]{14}$/);
    expect(first.length).toBeLessThanOrEqual(24);
    expect(first).not.toBe(second);
  });
});

describe("aislamiento por sucursal del repartidor", () => {
  it("un repartidor sin la sucursal de la entrega no puede asignarse", () => {
    expect(driverCoversBranch([1, 2], 2)).toBe(true);
    expect(driverCoversBranch([1], 2)).toBe(false);
    expect(driverCoversBranch([], 2)).toBe(false);
  });

  it("una entrega sin sucursal es válida para cualquier repartidor del tenant", () => {
    expect(driverCoversBranch([1], null)).toBe(true);
    expect(driverCoversBranch([1], undefined)).toBe(true);
  });
});