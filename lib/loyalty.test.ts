import { describe, expect, it } from "vitest";
import { loyaltyPoints, loyaltyTier, loyaltyTokenHash } from "@/lib/loyalty";

describe("fidelización", () => {
  it("asigna niveles según puntos", () => {
    expect(loyaltyTier(199)).toBe("inicial");
    expect(loyaltyTier(500)).toBe("oro");
  });

  it("calcula puntos y protege tokens", () => {
    expect(loyaltyPoints(8_500)).toBe(8);
    expect(loyaltyTokenHash("private")).toHaveLength(64);
  });
});
