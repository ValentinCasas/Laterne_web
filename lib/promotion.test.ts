import { describe, expect, it } from "vitest";
import { isPromotionActive, promotionBenefit } from "@/lib/promotion";

describe("vigencia de promociones", () => {
  it("respeta el período configurado", () => {
    const now = new Date("2026-08-10T22:00:00Z");
    expect(
      isPromotionActive(
        {
          startAt: new Date("2026-08-01T00:00:00Z"),
          endAt: new Date("2026-08-31T23:59:59Z"),
          startTime: null,
          endTime: null,
          daysOfWeek: [],
        },
        now,
      ),
    ).toBe(true);
  });

  it("rechaza una promoción que todavía no comenzó", () => {
    expect(
      isPromotionActive(
        {
          startAt: new Date("2027-01-01T00:00:00Z"),
          endAt: null,
          startTime: null,
          endTime: null,
          daysOfWeek: [],
        },
        new Date("2026-08-10T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("expresa descuentos y promociones por cantidad", () => {
    expect(promotionBenefit("percentage", 20, null, null)).toBe("20% OFF");
    expect(promotionBenefit("two_for_one", null, 2, 1)).toBe("2 × 1");
  });
});
