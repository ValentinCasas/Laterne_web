/**
 * Sistema de unidades de ingredientes y recetas.
 *
 * Unidades estándar por dimensión (masa, volumen, conteo) más conversiones
 * personalizadas por negocio (p. ej. 1 bolsa = 25 kg). La conversión es pura y
 * testeable: no toca la base de datos. El camino entre dos unidades se resuelve
 * con una búsqueda en el grafo de unidades (estándar + personalizadas), de modo
 * que `bolsa → kg → g` funciona aunque no exista una regla directa.
 */

export type UnitConversionRow = {
  fromUnit: string;
  toUnit: string;
  factor: number;
};

/** @summary Dimensiones físicas reconocidas de forma estándar. */
export type UnitDimension = "mass" | "volume" | "count";

type StandardUnit = { dimension: UnitDimension; factorToBase: number; label: string };

/** @summary Unidades estándar con su factor hacia la unidad base de la dimensión. */
const STANDARD_UNITS: Record<string, StandardUnit> = {
  // Masa (base: gramo)
  mg: { dimension: "mass", factorToBase: 0.001, label: "Miligramo" },
  g: { dimension: "mass", factorToBase: 1, label: "Gramo" },
  kg: { dimension: "mass", factorToBase: 1000, label: "Kilogramo" },
  oz: { dimension: "mass", factorToBase: 28.3495, label: "Onza" },
  lb: { dimension: "mass", factorToBase: 453.592, label: "Libra" },
  // Volumen (base: mililitro)
  ml: { dimension: "volume", factorToBase: 1, label: "Mililitro" },
  l: { dimension: "volume", factorToBase: 1000, label: "Litro" },
  cucharadita: { dimension: "volume", factorToBase: 5, label: "Cucharadita" },
  cucharada: { dimension: "volume", factorToBase: 15, label: "Cucharada" },
  taza: { dimension: "volume", factorToBase: 240, label: "Taza" },
  copa: { dimension: "volume", factorToBase: 200, label: "Copa" },
  // Conteo (base: unidad)
  unidad: { dimension: "count", factorToBase: 1, label: "Unidad" },
  docena: { dimension: "count", factorToBase: 12, label: "Docena" },
};

/** @summary Unidades disponibles en el selector de recetas (estándar). */
export const RECIPE_UNITS = Object.keys(STANDARD_UNITS);

/** @summary Devuelve la definición estándar de una unidad, o null si es personalizada/desconocida. */
export function standardUnit(unit: string): StandardUnit | null {
  return STANDARD_UNITS[unit.trim().toLocaleLowerCase("es")] ?? null;
}

/** @summary Aliases de unidades legadas que se guardaron con abreviaturas. */
const UNIT_ALIASES: Record<string, string> = {
  "unid.": "unidad",
  "uds.": "unidad",
  "und": "unidad",
};

/** @summary Normaliza una unidad a minúsculas sin espacios y resuelve aliases legados. */
export function normalizeUnit(unit: string): string {
  const normalized = unit.trim().toLocaleLowerCase("es").replace(/\s+/g, "_");
  return UNIT_ALIASES[normalized] ?? normalized;
}

/** @summary Etiqueta legible de una unidad (estándar o la propia). */
export function unitLabel(unit: string): string {
  const key = normalizeUnit(unit);
  const known = STANDARD_UNITS[key];
  return known?.label ?? key;
}

/** @summary Construye el grafo de conversión: aristas estándar + personalizadas en ambos sentidos. */
function conversionGraph(custom: readonly UnitConversionRow[] = []) {
  const edges = new Map<string, Array<{ to: string; factor: number }>>();
  const addEdge = (from: string, to: string, factor: number) => {
    const list = edges.get(from) ?? [];
    list.push({ to, factor });
    edges.set(from, list);
  };

  // Estándar: cada unidad se conecta con su base y viceversa.
  for (const [unit, def] of Object.entries(STANDARD_UNITS)) {
    if (def.factorToBase === 1) continue;
    addEdge(unit, def.dimension === "mass" ? "g" : def.dimension === "volume" ? "ml" : "unidad", def.factorToBase);
  }
  for (const [unit, def] of Object.entries(STANDARD_UNITS)) {
    if (def.factorToBase === 1) continue;
    const base = def.dimension === "mass" ? "g" : def.dimension === "volume" ? "ml" : "unidad";
    addEdge(base, unit, 1 / def.factorToBase);
  }

  // Personalizadas: ambas direcciones con el factor recíproco.
  for (const row of custom) {
    const from = normalizeUnit(row.fromUnit);
    const to = normalizeUnit(row.toUnit);
    if (!from || !to || from === to || !Number.isFinite(row.factor) || row.factor <= 0) continue;
    addEdge(from, to, row.factor);
    addEdge(to, from, 1 / row.factor);
  }
  return edges;
}

/** @summary Indica si se puede convertir entre dos unidades con las reglas dadas. */
export function isConvertible(fromUnit: string, toUnit: string, custom: readonly UnitConversionRow[] = []) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return true;
  const graph = conversionGraph(custom);
  const visited = new Set<string>([from]);
  const queue = [from];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const edge of graph.get(current) ?? []) {
      if (edge.to === to) return true;
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  return false;
}

/**
 * @summary Convierte una cantidad de una unidad a otra.
 *
 * Resuelve el camino más corto en el grafo de unidades (estándar + personalizadas)
 * multiplicando factores. Lanza un error claro si las unidades no son convertibles.
 * @param quantity Cantidad en la unidad de origen.
 * @param fromUnit Unidad de origen (p. ej. "kg").
 * @param toUnit Unidad de destino (p. ej. "g").
 * @param custom Conversiones personalizadas del negocio (1 bolsa = 25 kg → factor 25).
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  custom: readonly UnitConversionRow[] = [],
): number {
  if (!Number.isFinite(quantity)) throw new Error("La cantidad debe ser un número válido");
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return quantity;

  const graph = conversionGraph(custom);
  const visited = new Set<string>([from]);
  const queue: Array<{ unit: string; factor: number }> = [{ unit: from, factor: 1 }];
  while (queue.length) {
    const current = queue.shift() as { unit: string; factor: number };
    for (const edge of graph.get(current.unit) ?? []) {
      const nextFactor = current.factor * edge.factor;
      if (edge.to === to) return quantity * nextFactor;
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push({ unit: edge.to, factor: nextFactor });
      }
    }
  }
  throw new Error(`No se pueden convertir "${fromUnit}" a "${toUnit}"`);
}

/** @summary Redondea una cantidad a un máximo de decimales sin perder exactitud en costos. */
export function roundQuantity(value: number, decimals = 3): number {
  const factor = 10 ** Math.max(0, Math.min(9, Math.round(decimals)));
  return Math.round(value * factor) / factor;
}
