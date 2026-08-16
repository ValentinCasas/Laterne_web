import { describe, expect, it } from "vitest";
import {
  decimalOrNull,
  marginPercent,
  markupPercent,
  priceChannelLabel,
  priceChannels,
  timeOrNull,
} from "@/lib/product-catalog";

describe("marginPercent", () => {
  it("calcula el margen sobre el precio de venta", () => {
    expect(marginPercent(400, 1000)).toBe(60);
    expect(marginPercent(500, 1000)).toBe(50);
    expect(marginPercent(750, 1000)).toBe(25);
  });

  it("devuelve null cuando faltan datos válidos", () => {
    expect(marginPercent(null, 1000)).toBeNull();
    expect(marginPercent(400, null)).toBeNull();
    expect(marginPercent(0, 1000)).toBeNull();
    expect(marginPercent(400, 0)).toBeNull();
  });
});

describe("markupPercent", () => {
  it("calcula el markup sobre el costo", () => {
    expect(markupPercent(400, 1000)).toBe(150);
    expect(markupPercent(500, 1000)).toBe(100);
  });

  it("devuelve null cuando faltan datos válidos", () => {
    expect(markupPercent(null, 1000)).toBeNull();
    expect(markupPercent(400, null)).toBeNull();
    expect(markupPercent(0, 1000)).toBeNull();
  });
});

describe("decimalOrNull", () => {
  it("normaliza valores de formulario", () => {
    expect(decimalOrNull("12.5")).toBe(12.5);
    expect(decimalOrNull(12)).toBe(12);
    expect(decimalOrNull("")).toBeNull();
    expect(decimalOrNull(null)).toBeNull();
    expect(decimalOrNull(undefined)).toBeNull();
    expect(decimalOrNull("abc")).toBeNull();
  });
});

describe("timeOrNull", () => {
  it("convierte HH:mm en una hora aislada", () => {
    expect(timeOrNull("08:30")).toEqual(new Date("1970-01-01T08:30:00Z"));
    expect(timeOrNull("")).toBeNull();
    expect(timeOrNull(null)).toBeNull();
    expect(timeOrNull("8:30")).toBeNull();
  });
});

describe("priceChannels", () => {
  it("expone los canales de precio de la operación", () => {
    expect(priceChannels).toEqual(["SALON", "MOSTRADOR", "DELIVERY", "ONLINE"]);
    expect(priceChannelLabel.SALON).toBe("Salón");
    expect(priceChannelLabel.MOSTRADOR).toBe("Mostrador");
    expect(priceChannelLabel.DELIVERY).toBe("Delivery");
    expect(priceChannelLabel.ONLINE).toBe("Carta online");
  });
});
