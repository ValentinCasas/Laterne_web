import { describe, expect, it } from "vitest";
import {
  clampToFloor,
  gridPositions,
  gridPositionsAvoiding,
  isValidTablePosition,
  TABLE_COLLISION_UNITS,
} from "@/lib/table-layout";

describe("gridPositions", () => {
  it("centra una mesa única en el plano", () => {
    const positions = gridPositions([7]);
    expect(positions[7]).toEqual({ x: 500, y: 500 });
  });

  it("ubica dos mesas lado a lado y centradas, nunca en (0,0)", () => {
    const positions = gridPositions([1, 2]);
    const first = positions[1];
    const second = positions[2];
    expect(first.x).toBeLessThan(second.x);
    expect(first.y).toBe(second.y);
    expect(first.x).toBeGreaterThanOrEqual(60);
    expect(second.x).toBeLessThanOrEqual(940);
    expect([first.x, second.x]).not.toContain(0);
    expect(first.y).toBeGreaterThanOrEqual(60);
  });

  it("distribuye seis mesas en 3 columnas por 2 filas sin superponerse", () => {
    const ids = [1, 2, 3, 4, 5, 6];
    const positions = gridPositions(ids);
    const values = ids.map((id) => positions[id]);
    const uniqueXs = [...new Set(values.map((point) => point.x))].sort((a, b) => a - b);
    const uniqueYs = [...new Set(values.map((point) => point.y))].sort((a, b) => a - b);
    // Tres columnas distintas y dos filas distintas.
    expect(uniqueXs.length).toBe(3);
    expect(uniqueYs.length).toBe(2);
    // La separación horizontal y vertical es consistente.
    expect(uniqueXs[1] - uniqueXs[0]).toBe(150);
    expect(uniqueXs[2] - uniqueXs[1]).toBe(150);
    expect(uniqueYs[1] - uniqueYs[0]).toBe(150);
    // Todo dentro del plano con padding.
    for (const point of values) {
      expect(point.x).toBeGreaterThanOrEqual(60);
      expect(point.x).toBeLessThanOrEqual(940);
      expect(point.y).toBeGreaterThanOrEqual(60);
      expect(point.y).toBeLessThanOrEqual(940);
    }
  });

  it("soporta cantidades grandes manteniendo el rango válido", () => {
    const ids = Array.from({ length: 40 }, (_, index) => index + 1);
    const positions = gridPositions(ids);
    for (const point of Object.values(positions)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1000);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1000);
    }
  });

  it("devuelve un mapa vacío sin mesas", () => {
    expect(gridPositions([])).toEqual({});
  });

  it("es determinista: misma entrada, misma salida", () => {
    expect(gridPositions([10, 11, 12])).toEqual(gridPositions([10, 11, 12]));
  });
});

describe("gridPositionsAvoiding", () => {
  it("usa la grilla centrada cuando hay hueco libre", () => {
    expect(gridPositionsAvoiding([7])[7]).toEqual({ x: 500, y: 500 });
  });

  it("elige un hueco cercano sin colisionar con posiciones ocupadas", () => {
    const occupied = [{ x: 500, y: 500 }];
    const positions = gridPositionsAvoiding([1], occupied);
    const point = positions[1];
    const collides = occupied.some(
      (other) => Math.abs(point.x - other.x) < TABLE_COLLISION_UNITS && Math.abs(point.y - other.y) < TABLE_COLLISION_UNITS,
    );
    expect(collides).toBe(false);
    expect(point.x).toBeGreaterThanOrEqual(70);
    expect(point.x).toBeLessThanOrEqual(930);
    expect(point.y).toBeGreaterThanOrEqual(70);
    expect(point.y).toBeLessThanOrEqual(930);
  });

  it("no superpone las mesas sin posición entre sí", () => {
    const positions = gridPositionsAvoiding([1, 2, 3, 4]);
    const values = Object.values(positions);
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        const a = values[i];
        const b = values[j];
        const collide =
          Math.abs(a.x - b.x) < TABLE_COLLISION_UNITS && Math.abs(a.y - b.y) < TABLE_COLLISION_UNITS;
        expect(collide).toBe(false);
      }
    }
  });

  it("mantiene todas las posiciones dentro del plano con padding", () => {
    const positions = gridPositionsAvoiding([1, 2, 3, 4, 5]);
    for (const point of Object.values(positions)) {
      expect(point.x).toBeGreaterThanOrEqual(70);
      expect(point.x).toBeLessThanOrEqual(930);
      expect(point.y).toBeGreaterThanOrEqual(70);
      expect(point.y).toBeLessThanOrEqual(930);
    }
  });

  it("devuelve un mapa vacío sin mesas", () => {
    expect(gridPositionsAvoiding([])).toEqual({});
  });
});

describe("isValidTablePosition", () => {
  it("rechaza posiciones nulas o no numéricas", () => {
    expect(isValidTablePosition(null, null)).toBe(false);
    expect(isValidTablePosition(undefined, undefined)).toBe(false);
    expect(isValidTablePosition(0, null)).toBe(false);
  });

  it("rechaza el punto (0,0) típico de mesas nunca posicionadas", () => {
    expect(isValidTablePosition(0, 0)).toBe(false);
  });

  it("rechaza posiciones pegadas a los bordes o fuera de rango", () => {
    expect(isValidTablePosition(2, 500)).toBe(false);
    expect(isValidTablePosition(500, 998)).toBe(false);
    expect(isValidTablePosition(-5, 500)).toBe(false);
    expect(isValidTablePosition(1200, 500)).toBe(false);
  });

  it("acepta posiciones centrales", () => {
    expect(isValidTablePosition(500, 500)).toBe(true);
    expect(isValidTablePosition(150, 300)).toBe(true);
  });
});

describe("clampToFloor", () => {
  it("mantiene dentro del plano una mesa arrastrada al borde", () => {
    const clamped = clampToFloor({ x: 2, y: 998 }, 0.06, 0.07);
    expect(clamped.x).toBeGreaterThanOrEqual(60);
    expect(clamped.y).toBeLessThanOrEqual(930);
  });

  it("no modifica posiciones centrales", () => {
    expect(clampToFloor({ x: 500, y: 400 }, 0.06, 0.07)).toEqual({ x: 500, y: 400 });
  });

  it("aplica márgenes proporcionales al tamaño de la mesa", () => {
    // Mesa más ancha → margen horizontal mayor.
    const narrow = clampToFloor({ x: 0, y: 500 }, 0.05, 0.07);
    const wide = clampToFloor({ x: 0, y: 500 }, 0.1, 0.07);
    expect(wide.x).toBeGreaterThan(narrow.x);
  });
});
