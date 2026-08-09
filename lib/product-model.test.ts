import { describe, expect, it } from "vitest";
import { localModelUrl, modelOrientation, optionalMeasurement } from "@/lib/product-model";

describe("configuración espacial de productos", () => {
  it("acepta únicamente modelos pertenecientes al tenant indicado", () => {
    expect(localModelUrl("/models/7/products/vaso.glb", 7, ["glb", "gltf"])).toBe(
      "/models/7/products/vaso.glb",
    );
    expect(() => localModelUrl("/models/8/products/vaso.glb", 7, ["glb"])).toThrow(/gestor seguro/i);
  });

  it("valida medidas realistas y conserva valores opcionales", () => {
    expect(optionalMeasurement("25.5")).toBe(25.5);
    expect(optionalMeasurement("")).toBeNull();
    expect(() => optionalMeasurement("5000")).toThrow(/medida/i);
  });

  it("normaliza la orientación y rechaza expresiones ambiguas", () => {
    expect(modelOrientation("")).toBe("0deg 0deg 0deg");
    expect(modelOrientation("0deg 90deg -15deg")).toBe("0deg 90deg -15deg");
    expect(() => modelOrientation("girar a la izquierda")).toThrow(/rotación/i);
  });
});
