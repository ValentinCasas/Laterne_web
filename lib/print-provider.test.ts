import { describe, expect, it } from "vitest";
import {
  printDestinationTypes,
  printJobStatuses,
  registeredPrintProviders,
  resolvePrintProvider,
} from "@/lib/print-provider";

describe("registro de proveedores de impresión", () => {
  it("no tiene proveedores registrados: la impresión no es operativa todavía", () => {
    expect(registeredPrintProviders()).toEqual([]);
  });

  it("no resuelve ningún tipo de destino hasta que exista una integración real", () => {
    for (const type of printDestinationTypes) {
      expect(resolvePrintProvider(type)).toBeNull();
    }
  });

  it("expone los cuatro tipos de destino previstos para el futuro", () => {
    expect([...printDestinationTypes]).toEqual(["ETHERNET", "BLUETOOTH", "USB", "LOCAL_SERVICE"]);
  });
});

describe("estados conceptuales de la cola de comandas", () => {
  it("expone exactamente pending, processing, printed, failed y cancelled", () => {
    expect([...printJobStatuses]).toEqual(["pending", "processing", "printed", "failed", "cancelled"]);
  });
});
