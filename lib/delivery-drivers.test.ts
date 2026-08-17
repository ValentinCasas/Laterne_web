import { describe, expect, it } from "vitest";
import { canRetireDelivery, orderStatusForDelivery, deliveryStatusMeta } from "./delivery-drivers";

describe("canRetireDelivery", () => {
  it("habilita el retiro solo cuando el pedido está LISTO o en camino", () => {
    expect(canRetireDelivery("ready")).toBe(true);
    expect(canRetireDelivery("on_the_way")).toBe(true);
  });

  it("bloquea el retiro antes de LISTO y en estados finales", () => {
    expect(canRetireDelivery("received")).toBe(false);
    expect(canRetireDelivery("confirmed")).toBe(false);
    expect(canRetireDelivery("preparing")).toBe(false);
    expect(canRetireDelivery("delivered")).toBe(false);
    expect(canRetireDelivery("cancelled")).toBe(false);
    expect(canRetireDelivery(undefined)).toBe(false);
    expect(canRetireDelivery(null)).toBe(false);
    expect(canRetireDelivery("")).toBe(false);
  });
});

describe("orderStatusForDelivery", () => {
  it("mapea EN CAMINO y ENTREGADO al ciclo del pedido", () => {
    expect(orderStatusForDelivery("ON_THE_WAY")).toBe("on_the_way");
    expect(orderStatusForDelivery("DELIVERED")).toBe("delivered");
  });

  it("RETIRADO y el resto no alteran el estado del pedido", () => {
    expect(orderStatusForDelivery("PICKED_UP")).toBeNull();
    expect(orderStatusForDelivery("ASSIGNED")).toBeNull();
    expect(orderStatusForDelivery("PENDING_ASSIGNMENT")).toBeNull();
    expect(orderStatusForDelivery("INCIDENT")).toBeNull();
    expect(orderStatusForDelivery("FAILED")).toBeNull();
    expect(orderStatusForDelivery(null)).toBeNull();
    expect(orderStatusForDelivery(undefined)).toBeNull();
  });
});

describe("deliveryStatusMeta", () => {
  it("devuelve metadatos conocidos y un respaldo seguro", () => {
    expect(deliveryStatusMeta("ASSIGNED").label).toBe("Asignado");
    expect(deliveryStatusMeta("INCIDENT").label).toBe("Incidencia");
    expect(deliveryStatusMeta("CANCELLED").label).toBe("Cancelado");
    expect(deliveryStatusMeta("DESCONOCIDO").label).toBe("DESCONOCIDO");
    expect(deliveryStatusMeta(undefined).label).toBe("Desconocido");
  });
});
