import { describe, expect, it } from "vitest";
import { productAvailableAt } from "@/lib/product-availability";

describe("productAvailableAt", () => {
  it("respeta días habilitados", () => {
    expect(productAvailableAt([1], null, null, new Date(2026, 7, 10, 12))).toBe(true);
    expect(productAvailableAt([2], null, null, new Date(2026, 7, 10, 12))).toBe(false);
  });

  it("admite una franja que cruza medianoche", () => {
    const start = new Date("1970-01-01T20:00:00Z");
    const end = new Date("1970-01-01T02:00:00Z");
    expect(productAvailableAt([], start, end, new Date(2026, 7, 10, 23))).toBe(true);
    expect(productAvailableAt([], start, end, new Date(2026, 7, 10, 12))).toBe(false);
  });

  it("evalúa el día según la zona horaria del negocio y no la del servidor", () => {
    const instant = new Date("2026-08-10T02:30:00Z");

    expect(productAvailableAt([0], null, null, instant, "America/Argentina/Buenos_Aires")).toBe(true);
    expect(productAvailableAt([1], null, null, instant, "Europe/Madrid")).toBe(true);
  });
});
