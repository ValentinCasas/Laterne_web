/**
 * Lógica pura de posición de mesas en el plano del salón.
 *
 * Las coordenadas viven en un espacio abstracto 0-1000 (equivalente a 0%-100%
 * del plano), independiente del tamaño real del contenedor. Mantener esta
 * lógica aislada permite testearla sin DOM y reutilizarla tanto en el tablero
 * como en la acción de "Ordenar automáticamente".
 */

export type Point = { x: number; y: number };

/** @summary Límites del espacio de coordenadas del plano. */
export const FLOOR_MIN = 0;
export const FLOOR_MAX = 1000;

/** @summary Margen mínimo (en unidades) que separa una mesa del borde del plano. */
export const FLOOR_EDGE_MARGIN = 8;

/**
 * @summary Indica si una coordenada guardada es utilizable.
 *
 * Una posición válida debe ser un número finito, no estar apilada en (0,0) y
 * dejar margen de borde para que la mesa no quede cortada por el canvas.
 */
export function isValidTablePosition(x: number | null | undefined, y: number | null | undefined): boolean {
  if (typeof x !== "number" || typeof y !== "number") return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  if (x < FLOOR_EDGE_MARGIN || y < FLOOR_EDGE_MARGIN) return false;
  if (x > FLOOR_MAX - FLOOR_EDGE_MARGIN || y > FLOOR_MAX - FLOOR_EDGE_MARGIN) return false;
  return !(x === 0 && y === 0);
}

/**
 * @summary Distribuye mesas en una grilla centrada con separación consistente.
 *
 * La grilla se centra en el plano (nunca en la esquina superior izquierda), usa
 * separación uniforme y deja padding respecto de los bordes. La separación se
 * adapta cuando hay muchas mesas para que el conjunto siempre quepa dentro del
 * plano. Es la posición por defecto de mesas sin coordenadas y el resultado de
 * "Ordenar automáticamente".
 */
export function gridPositions(ids: number[]): Record<number, Point> {
  const positions: Record<number, Point> = {};
  const count = ids.length;
  if (count === 0) return positions;
  const edge = 70;
  const maxSpacing = 150;
  const columns = Math.min(count, Math.max(1, Math.ceil(Math.sqrt(count * 1.25))));
  const rows = Math.ceil(count / columns);
  const spacingX = Math.min(
    maxSpacing,
    Math.max(60, (FLOOR_MAX - edge * 2) / Math.max(1, columns - 1)),
  );
  const spacingY = Math.min(
    maxSpacing,
    Math.max(60, (FLOOR_MAX - edge * 2) / Math.max(1, rows - 1)),
  );
  const gridWidth = (columns - 1) * spacingX;
  const gridHeight = (rows - 1) * spacingY;
  const startX = (FLOOR_MAX - gridWidth) / 2;
  const startY = (FLOOR_MAX - gridHeight) / 2;
  ids.forEach((id, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions[id] = {
      x: Math.round(startX + col * spacingX),
      y: Math.round(startY + row * spacingY),
    };
  });
  return positions;
}

/** @summary Distancia mínima (en unidades) entre centros para considerar que dos mesas colisionan. */
export const TABLE_COLLISION_UNITS = 95;

/** @summary Grilla completa del plano usada como reserva de huecos libres. */
function floorCandidates(): Point[] {
  const candidates: Point[] = [];
  for (let y = 70; y <= FLOOR_MAX - 70; y += 150) {
    for (let x = 70; x <= FLOOR_MAX - 70; x += 150) {
      candidates.push({ x, y });
    }
  }
  return candidates;
}

/** @summary Indica si un punto colisiona con alguno de la lista (mismo espacio de mesa). */
function collidesWith(point: Point, list: Point[]) {
  return list.some(
    (other) => Math.abs(point.x - other.x) < TABLE_COLLISION_UNITS && Math.abs(point.y - other.y) < TABLE_COLLISION_UNITS,
  );
}

/**
 * @summary Posiciones por defecto que respetan las mesas ya posicionadas.
 *
 * Intenta primero la grilla centrada de `gridPositions` (la misma de "Ordenar
 * automáticamente"); si un hueco preferido está ocupado por otra mesa o por una
 * posición guardada, busca el hueco libre más cercano en el plano. Así las mesas
 * sin coordenadas quedan distribuidas en una grilla prolija y centrada, nunca en
 * (0,0), sin superponerse entre sí ni con mesas ya posicionadas.
 */
export function gridPositionsAvoiding(ids: number[], occupied: Point[] = []): Record<number, Point> {
  const positions: Record<number, Point> = {};
  const used: Point[] = [];
  const preferred = gridPositions(ids);
  const fallbacks = floorCandidates();
  const nearestFree = (anchor: Point) =>
    [...fallbacks]
      .sort(
        (left, right) =>
          Math.abs(left.x - anchor.x) + Math.abs(left.y - anchor.y) -
          (Math.abs(right.x - anchor.x) + Math.abs(right.y - anchor.y)),
      )
      .find((candidate) => !collidesWith(candidate, occupied) && !collidesWith(candidate, used));
  for (const id of ids) {
    const anchor = preferred[id] ?? { x: 500, y: 500 };
    const freePreferred = !collidesWith(anchor, occupied) && !collidesWith(anchor, used);
    const point = freePreferred ? anchor : (nearestFree(anchor) ?? { x: 500, y: 500 });
    positions[id] = point;
    used.push(point);
  }
  return positions;
}

/**
 * @summary Ajusta una posición para que la mesa completa quede dentro del plano.
 *
 * `halfWidthRatio` y `halfHeightRatio` son la mitad del tamaño de la mesa sobre
 * el tamaño del plano (0-1). Con ellas se calcula el margen real que impide que
 * la mesa quede cortada por los bordes.
 */
export function clampToFloor(point: Point, halfWidthRatio: number, halfHeightRatio: number): Point {
  const marginX = Math.min(95, Math.max(0, halfWidthRatio) * FLOOR_MAX);
  const marginY = Math.min(95, Math.max(0, halfHeightRatio) * FLOOR_MAX);
  return {
    x: Math.round(Math.min(FLOOR_MAX - marginX, Math.max(marginX, point.x))),
    y: Math.round(Math.min(FLOOR_MAX - marginY, Math.max(marginY, point.y))),
  };
}
