import { describe, expect, it } from "vitest";
import {
  isPromotionActive,
  promotionBenefit,
  promotionDiscount,
  resolveOrderPromotion,
  type PromotionCandidate,
  type PromotionItem,
} from "@/lib/promotion";

const BA = "America/Argentina/Buenos_Aires";

const items: PromotionItem[] = [
  { productId: 1, categoryIds: [10], unitPrice: 100, perUnit: 100, linePrice: 200, quantity: 2 },
  { productId: 2, categoryIds: [11], unitPrice: 50, perUnit: 60, linePrice: 120, quantity: 2 },
];

function candidate(overrides: Partial<PromotionCandidate> = {}): PromotionCandidate {
  return {
    id: 1,
    name: "Promo de prueba",
    type: "percentage",
    discountValue: 10,
    minimumPurchase: null,
    buyQuantity: null,
    receiveQuantity: null,
    code: null,
    status: "published",
    publishAt: null,
    startAt: null,
    endAt: null,
    startTime: null,
    endTime: null,
    daysOfWeek: [],
    priority: 0,
    productIds: [],
    categoryIds: [],
    ...overrides,
  };
}

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

  it("rechaza borradores y promociones aún no publicadas", () => {
    const now = new Date("2026-08-10T22:00:00Z");
    expect(
      isPromotionActive(
        { status: "draft", startAt: null, endAt: null, startTime: null, endTime: null, daysOfWeek: [] },
        now,
      ),
    ).toBe(false);
    expect(
      isPromotionActive(
        {
          status: "scheduled",
          publishAt: new Date("2026-09-01T00:00:00Z"),
          startAt: null,
          endAt: null,
          startTime: null,
          endTime: null,
          daysOfWeek: [],
        },
        now,
      ),
    ).toBe(false);
  });

  it("aplica días de la semana en el huso horario del local", () => {
    const sábado = new Date("2026-08-08T22:00:00Z");
    const martes = new Date("2026-08-11T22:00:00Z");
    const schedule = { daysOfWeek: ["sábado"], startAt: null, endAt: null, startTime: null, endTime: null };
    expect(isPromotionActive(schedule, sábado, BA)).toBe(true);
    expect(isPromotionActive(schedule, martes, BA)).toBe(false);
  });

  it("acepta horarios que cruzan la medianoche", () => {
    const schedule = {
      daysOfWeek: [],
      startAt: null,
      endAt: null,
      startTime: new Date("1970-01-01T22:00:00Z"),
      endTime: new Date("1970-01-01T03:00:00Z"),
    };
    expect(isPromotionActive(schedule, new Date("2026-08-08T01:30:00Z"), BA)).toBe(true);
    expect(isPromotionActive(schedule, new Date("2026-08-08T15:00:00Z"), BA)).toBe(false);
  });
});

describe("beneficios públicos", () => {
  it("expresa descuentos y promociones por cantidad", () => {
    expect(promotionBenefit("percentage", 20, null, null)).toBe("20% OFF");
    expect(promotionBenefit("two_for_one", null, 2, 1)).toBe("2 × 1");
  });

  it("describe descuentos fijos y precios especiales en pesos", () => {
    expect(promotionBenefit("fixed_amount", 500, null, null)).toBe(`$${"\u00A0"}500`);
    expect(promotionBenefit("special_price", 80, null, null)).toBe(`$${"\u00A0"}80`);
  });
});

describe("descuento del motor", () => {
  it("aplica un porcentaje global al subtotal", () => {
    const promo = candidate();
    expect(promotionDiscount(promo, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(32);
  });

  it("acota el porcentaje a los productos alcanzados", () => {
    const promo = candidate({ productIds: [1], categoryIds: [] });
    expect(promotionDiscount(promo, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(20);
  });

  it("aplica un descuento fijo sin superar el subtotal alcanzado", () => {
    const promo = candidate({ type: "fixed_amount", discountValue: 150, productIds: [], categoryIds: [] });
    expect(promotionDiscount(promo, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(150);
    const scoped = candidate({ type: "fixed_amount", discountValue: 150, productIds: [2], categoryIds: [] });
    expect(promotionDiscount(scoped, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(120);
  });

  it("reemplaza el precio por unidad en el precio especial", () => {
    const promo = candidate({ type: "special_price", discountValue: 80, productIds: [1], categoryIds: [] });
    expect(promotionDiscount(promo, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(40);
    const overPrice = candidate({
      type: "special_price",
      discountValue: 150,
      productIds: [1],
      categoryIds: [],
    });
    expect(promotionDiscount(overPrice, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(0);
  });

  it("regala unidades completas en dos por uno", () => {
    const promo = candidate({
      type: "two_for_one",
      discountValue: null,
      buyQuantity: 2,
      receiveQuantity: 1,
      productIds: [2],
      categoryIds: [],
    });
    expect(promotionDiscount(promo, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(0);
    const threeUnits: PromotionItem[] = [{ ...items[1], quantity: 3, linePrice: 180 }];
    expect(promotionDiscount(promo, threeUnits, 180, new Date("2026-08-10T22:00:00Z"), BA)).toBe(60);
  });

  it("respeta la compra mínima", () => {
    const bigger: PromotionItem[] = [
      { productId: 1, categoryIds: [10], unitPrice: 100, perUnit: 100, linePrice: 400, quantity: 4 },
      { productId: 2, categoryIds: [11], unitPrice: 50, perUnit: 60, linePrice: 200, quantity: 4 },
    ];
    const promo = candidate({ minimumPurchase: 500 });
    expect(promotionDiscount(promo, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(0);
    expect(promotionDiscount(promo, bigger, 600, new Date("2026-08-10T22:00:00Z"), BA)).toBe(60);
  });

  it("no descuenta tipos no implementados", () => {
    const promo = candidate({ type: "combo", discountValue: 10, productIds: [], categoryIds: [] });
    expect(promotionDiscount(promo, items, 320, new Date("2026-08-10T22:00:00Z"), BA)).toBe(0);
  });

  it("no descuenta promociones inactivas o sin código cuando el carrito ingresa uno", () => {
    expect(
      promotionDiscount(candidate({ status: "draft" }), items, 320, new Date("2026-08-10T22:00:00Z"), BA),
    ).toBe(0);
  });
});

describe("resolución del mejor descuento", () => {
  it("elige el descuento más beneficioso entre promociones automáticas", () => {
    const result = resolveOrderPromotion(
      [
        candidate({ id: 1, priority: 0, discountValue: 5 }),
        candidate({ id: 2, priority: 0, discountValue: 20 }),
      ],
      items,
      320,
      null,
      new Date("2026-08-10T22:00:00Z"),
      BA,
    );
    expect(result.discount).toBe(64);
    expect(result.promotionId).toBe(2);
  });

  it("aplica el código promocional ingresado aunque existan automáticas", () => {
    const result = resolveOrderPromotion(
      [candidate({ id: 1, discountValue: 10 }), candidate({ id: 2, code: "LATERNE20", discountValue: 20 })],
      items,
      320,
      "laterne20",
      new Date("2026-08-10T22:00:00Z"),
      BA,
    );
    expect(result.discount).toBe(64);
    expect(result.promotionCode).toBe("LATERNE20");
    expect(result.promotionLabel).toContain("20% OFF");
  });

  it("no aplica un código desconocido", () => {
    const result = resolveOrderPromotion(
      [candidate({ id: 1, discountValue: 10 })],
      items,
      320,
      "NO_EXISTE",
      new Date("2026-08-10T22:00:00Z"),
      BA,
    );
    expect(result.discount).toBe(0);
    expect(result.promotionId).toBeNull();
  });
});
