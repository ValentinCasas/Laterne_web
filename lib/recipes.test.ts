import { describe, expect, it } from "vitest";
import {
  assertNoRecipeCycles,
  expandRecipeToLeaves,
  graphWithLines,
  recipeCostBreakdown,
  recipeCostPerUnit,
  recipeGraphHasCycle,
  recipeLinesOf,
  type RecipeCostInfo,
  type RecipeGraph,
} from "@/lib/recipes";

/** @summary Construye un mapa de costo simple para pruebas. */
function costInfo(entries: Array<{ id: number; name: string; cost: number | null; costUnit?: string; hasRecipe?: boolean }>) {
  return new Map<number, RecipeCostInfo>(
    entries.map((entry) => [
      entry.id,
      {
        id: entry.id,
        name: entry.name,
        cost: entry.cost,
        costUnit: entry.costUnit ?? "unidad",
        hasRecipe: entry.hasRecipe ?? false,
      },
    ]),
  );
}

describe("ciclos de subrecetas", () => {
  it("detecta un ciclo directo", () => {
    const graph: RecipeGraph = new Map([
      [1, [{ ingredientProductId: 2, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
      [2, [{ ingredientProductId: 1, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
    ]);
    expect(recipeGraphHasCycle(graph, 1)).toBe(true);
  });

  it("detecta un ciclo transitivo", () => {
    const graph: RecipeGraph = new Map([
      [1, [{ ingredientProductId: 2, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
      [2, [{ ingredientProductId: 3, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
      [3, [{ ingredientProductId: 1, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
    ]);
    expect(recipeGraphHasCycle(graph, 1)).toBe(true);
  });

  it("no marca ciclos en recetas sanas", () => {
    const graph: RecipeGraph = new Map([
      [1, [{ ingredientProductId: 2, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
      [2, [{ ingredientProductId: 3, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
    ]);
    expect(recipeGraphHasCycle(graph, 1)).toBe(false);
  });

  it("graphWithLines y assertNoRecipeCycles bloquean un guardado que generaría ciclo", () => {
    const graph: RecipeGraph = new Map([
      [1, [{ ingredientProductId: 2, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
    ]);
    const candidate = graphWithLines(graph, 2, [{ ingredientProductId: 1, quantity: 1, unit: "unidad", yieldPercent: 100 }]);
    expect(recipeGraphHasCycle(candidate, 2)).toBe(true);
    expect(() => assertNoRecipeCycles(candidate, 2)).toThrow(/ciclo de subrecetas/);
    // Sin el cambio, el guardado es válido.
    expect(() => assertNoRecipeCycles(graph, 1)).not.toThrow();
  });
});

describe("expandRecipeToLeaves", () => {
  const info = costInfo([
    { id: 10, name: "Harina", cost: 1, costUnit: "kg" },
    { id: 11, name: "Agua", cost: 1, costUnit: "l" },
    { id: 12, name: "Masa", cost: null, costUnit: "unidad", hasRecipe: true },
    { id: 13, name: "Salsa", cost: null, costUnit: "unidad", hasRecipe: true },
    { id: 14, name: "Tomate", cost: 1, costUnit: "kg" },
    { id: 20, name: "Pizza", cost: null, costUnit: "unidad", hasRecipe: true },
  ]);

  it("expande receta simple con conversión de unidades", () => {
    const graph: RecipeGraph = new Map([
      [
        20,
        [
          { ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 100 },
          { ingredientProductId: 11, quantity: 150, unit: "ml", yieldPercent: 100 },
        ],
      ],
    ]);
    const leaves = expandRecipeToLeaves(graph, info, [], 20, 1);
    expect(leaves.get(10)).toEqual({ quantity: 0.25, unit: "kg" });
    expect(leaves.get(11)).toEqual({ quantity: 0.15, unit: "l" });
  });

  it("aplica rendimiento/merma (90% de rendimiento → se necesita más materia prima)", () => {
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 0.9, unit: "kg", yieldPercent: 90 }]],
    ]);
    const leaves = expandRecipeToLeaves(graph, info, [], 20, 1);
    expect(leaves.get(10)!.quantity).toBeCloseTo(1, 6);
  });

  it("expande subrecetas recursivamente", () => {
    const graph: RecipeGraph = new Map([
      [
        20,
        [
          { ingredientProductId: 12, quantity: 1, unit: "unidad", yieldPercent: 100 },
          { ingredientProductId: 13, quantity: 1, unit: "unidad", yieldPercent: 100 },
        ],
      ],
      [12, [{ ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 100 }]],
      [13, [{ ingredientProductId: 14, quantity: 0.1, unit: "kg", yieldPercent: 100 }]],
    ]);
    const leaves = expandRecipeToLeaves(graph, info, [], 20, 1);
    expect(leaves.get(10)!.quantity).toBeCloseTo(0.25, 6);
    expect(leaves.get(14)!.quantity).toBeCloseTo(0.1, 6);
  });

  it("agrega cantidades de distintas ramas del mismo ingrediente", () => {
    const graph: RecipeGraph = new Map([
      [
        20,
        [
          { ingredientProductId: 12, quantity: 1, unit: "unidad", yieldPercent: 100 },
          { ingredientProductId: 10, quantity: 0.05, unit: "kg", yieldPercent: 100 },
        ],
      ],
      [12, [{ ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 100 }]],
    ]);
    const leaves = expandRecipeToLeaves(graph, info, [], 20, 2);
    // 2 pizzas: masa (2 × 0.25) + directo (2 × 0.05)
    expect(leaves.get(10)!.quantity).toBeCloseTo(0.6, 6);
  });

  it("devuelve el producto mismo cuando no tiene receta", () => {
    const graph: RecipeGraph = new Map();
    const leaves = expandRecipeToLeaves(graph, info, [], 10, 3);
    expect(leaves.get(10)).toEqual({ quantity: 3, unit: "kg" });
  });

  it("lanza error ante un ciclo durante la expansión", () => {
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 12, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
      [12, [{ ingredientProductId: 20, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
    ]);
    expect(() => expandRecipeToLeaves(graph, info, [], 20, 1)).toThrow(/Ciclo de subrecetas/);
  });
});

describe("recipeCostPerUnit", () => {
  it("calcula el costo simple con conversión de unidades", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: 100, costUnit: "kg" },
      { id: 20, name: "Pan", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 200, unit: "g", yieldPercent: 100 }]],
    ]);
    // 200 g = 0.2 kg × 100 = 20
    expect(recipeCostPerUnit(graph, info, [], 20)).toBe(20);
  });

  it("aplica merma en el costo", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: 100, costUnit: "kg" },
      { id: 20, name: "Pan", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 0.1, unit: "kg", yieldPercent: 80 }]],
    ]);
    // 0.1 × 100/80 = 0.125 kg × 100 = 12.5
    expect(recipeCostPerUnit(graph, info, [], 20)).toBeCloseTo(12.5, 6);
  });

  it("incluye el costo de subrecetas recursivamente", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: 100, costUnit: "kg" },
      { id: 12, name: "Masa", cost: null, costUnit: "unidad", hasRecipe: true },
      { id: 20, name: "Pizza", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 12, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
      [12, [{ ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 100 }]],
    ]);
    // Masa = 0.25 × 100 = 25 → Pizza = 1 × 25 = 25
    expect(recipeCostPerUnit(graph, info, [], 12)).toBe(25);
    expect(recipeCostPerUnit(graph, info, [], 20)).toBe(25);
  });

  it("usa el costo propio cuando el producto no tiene receta", () => {
    const info = costInfo([{ id: 10, name: "Harina", cost: 80, costUnit: "kg" }]);
    expect(recipeCostPerUnit(new Map(), info, [], 10)).toBe(80);
  });

  it("devuelve null si algún ingrediente no tiene costo", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: null, costUnit: "kg" },
      { id: 20, name: "Pan", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 1, unit: "kg", yieldPercent: 100 }]],
    ]);
    expect(recipeCostPerUnit(graph, info, [], 20)).toBeNull();
  });

  it("devuelve null ante unidades no convertibles", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: 100, costUnit: "kg" },
      { id: 20, name: "Pan", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 500, unit: "ml", yieldPercent: 100 }]],
    ]);
    expect(recipeCostPerUnit(graph, info, [], 20)).toBeNull();
  });
});

describe("recipeCostBreakdown", () => {
  it("desglosa líneas con costo y total", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: 100, costUnit: "kg" },
      { id: 11, name: "Agua", cost: 1, costUnit: "l" },
      { id: 20, name: "Masa", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [
        20,
        [
          { ingredientProductId: 10, quantity: 0.25, unit: "kg", yieldPercent: 100 },
          { ingredientProductId: 11, quantity: 150, unit: "ml", yieldPercent: 100 },
        ],
      ],
    ]);
    const breakdown = recipeCostBreakdown(graph, info, [], 20);
    expect(breakdown.totalCost).toBeCloseTo(25.15, 6);
    expect(breakdown.incomplete).toBe(false);
    expect(breakdown.lines).toHaveLength(2);
    expect(breakdown.lines[0]).toMatchObject({ name: "Harina", convertedQuantity: 0.25, baseUnit: "kg" });
    expect(breakdown.lines[1]).toMatchObject({ name: "Agua", convertedQuantity: 0.15, baseUnit: "l" });
  });

  it("marca receta incompleta cuando falta costo", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: null, costUnit: "kg" },
      { id: 20, name: "Masa", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 1, unit: "kg", yieldPercent: 100 }]],
    ]);
    const breakdown = recipeCostBreakdown(graph, info, [], 20);
    expect(breakdown.totalCost).toBeNull();
    expect(breakdown.incomplete).toBe(true);
    expect(breakdown.reasons.some((reason) => reason.includes("no tiene costo"))).toBe(true);
  });

  it("marca receta incompleta cuando la unidad no es convertible", () => {
    const info = costInfo([
      { id: 10, name: "Harina", cost: 100, costUnit: "kg" },
      { id: 20, name: "Masa", cost: null, costUnit: "unidad", hasRecipe: true },
    ]);
    const graph: RecipeGraph = new Map([
      [20, [{ ingredientProductId: 10, quantity: 1, unit: "taza", yieldPercent: 100 }]],
    ]);
    const breakdown = recipeCostBreakdown(graph, info, [], 20);
    expect(breakdown.incomplete).toBe(true);
    expect(breakdown.reasons.some((reason) => reason.includes("No se puede convertir"))).toBe(true);
  });

  it("marca ciclos en el desglose", () => {
    const info = costInfo([{ id: 10, name: "X", cost: 1, costUnit: "unidad" }]);
    const graph: RecipeGraph = new Map([
      [1, [{ ingredientProductId: 2, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
      [2, [{ ingredientProductId: 1, quantity: 1, unit: "unidad", yieldPercent: 100 }]],
    ]);
    const breakdown = recipeCostBreakdown(graph, info, [], 1);
    expect(breakdown.reasons.some((reason) => reason.includes("ciclo"))).toBe(true);
  });

  it("expone recipeLinesOf para recorrer el grafo", () => {
    const graph: RecipeGraph = new Map([[1, [{ ingredientProductId: 2, quantity: 1, unit: "unidad", yieldPercent: 100 }]]]);
    expect(recipeLinesOf(graph, 1)).toHaveLength(1);
    expect(recipeLinesOf(graph, 99)).toHaveLength(0);
  });
});
