import { describe, expect, it } from "vitest";
import { buildComandaData, comandaExtras } from "@/lib/comanda";

const sampleOrder = {
  id: 42,
  reference: "PED-0001",
  orderType: "dine_in",
  customerName: "Laura Pérez",
  notes: "  Sin cebolla en la milanesa.  ",
  createdAt: new Date("2026-08-16T20:05:00.000Z"),
  requestedAt: new Date("2026-08-16T20:30:00.000Z"),
  table: { name: "Mesa 12", sector: " Terraza " },
  tableSession: { waiter: { name: "Martín" } },
  items: [
    {
      productName: "Milanesa napolitana",
      quantity: 2,
      variantName: "Con papas fritas",
      extras: [
        { name: "Queso extra", price: 900 },
        { name: "Huevo frito", price: 700 },
      ],
      notes: "  Punto jugosa  ",
    },
    {
      productName: "Cerveza artesanal",
      quantity: 1,
      variantName: null,
      extras: null,
      notes: null,
    },
  ],
};

describe("buildComandaData", () => {
  it("arma una comanda estructurada independiente del formato físico", () => {
    const comanda = buildComandaData(sampleOrder);
    expect(comanda.orderId).toBe(42);
    expect(comanda.reference).toBe("PED-0001");
    expect(comanda.orderType).toBe("dine_in");
    expect(comanda.customerName).toBe("Laura Pérez");
    expect(comanda.table).toEqual({ name: "Mesa 12", sector: "Terraza" });
    expect(comanda.waiter).toBe("Martín");
    expect(comanda.items).toHaveLength(2);
    expect(comanda.createdAt).toBe("2026-08-16T20:05:00.000Z");
    expect(comanda.requestedAt).toBe("2026-08-16T20:30:00.000Z");
  });

  it("incluye productos, cantidades, modificadores y notas de cada línea", () => {
    const comanda = buildComandaData(sampleOrder);
    const [item] = comanda.items;
    expect(item.productName).toBe("Milanesa napolitana");
    expect(item.quantity).toBe(2);
    expect(item.variantName).toBe("Con papas fritas");
    expect(item.extras).toEqual([
      { name: "Queso extra", price: 900 },
      { name: "Huevo frito", price: 700 },
    ]);
    expect(item.notes).toBe("Punto jugosa");
  });

  it("normaliza líneas sin variantes, agregados ni notas", () => {
    const comanda = buildComandaData(sampleOrder);
    const [, beer] = comanda.items;
    expect(beer.variantName).toBeNull();
    expect(beer.extras).toEqual([]);
    expect(beer.notes).toBeNull();
  });

  it("maneja pedidos de mesa sin camarero asignado y sin notas", () => {
    const comanda = buildComandaData({
      ...sampleOrder,
      tableSession: null,
      notes: null,
      requestedAt: null,
    });
    expect(comanda.waiter).toBeNull();
    expect(comanda.notes).toBeNull();
    expect(comanda.requestedAt).toBeNull();
    expect(comanda.table).toEqual({ name: "Mesa 12", sector: "Terraza" });
  });
});

describe("comandaExtras", () => {
  it("convierte el JSON de agregados en una lista estable de nombre y precio", () => {
    expect(comandaExtras([{ name: "Queso", price: 500 }, { name: "Bacon" }, null, "suelto"])).toEqual([
      { name: "Queso", price: 500 },
      { name: "Bacon" },
    ]);
  });

  it("devuelve una lista vacía cuando no hay agregados", () => {
    expect(comandaExtras(null)).toEqual([]);
    expect(comandaExtras([])).toEqual([]);
  });
});
