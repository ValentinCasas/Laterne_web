import { describe, expect, it } from "vitest";
import { analyticsHash, sanitizeAnalyticsMetadata } from "@/lib/analytics";

describe("analítica", () => {
  it("anonimiza identificadores", () => {
    expect(analyticsHash("session", "abc")).toHaveLength(64);
  });

  it("descarta metadatos complejos o peligrosos", () => {
    expect(
      sanitizeAnalyticsMetadata({ valid: 3, name: "cerveza", nested: { private: true }, "bad-key": 1 }),
    ).toEqual({ valid: 3, name: "cerveza" });
  });
});
