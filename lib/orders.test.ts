import { describe, expect, it } from "vitest";
import { orderStatusLabel, whatsappPhone } from "@/lib/orders";
import { orderReference, orderTokenHash } from "@/lib/order-security";

describe("pedidos", () => {
  it("genera referencias legibles", () => {
    expect(orderReference(new Date("2026-08-09T12:00:00Z"))).toMatch(/^PED-260809-[A-F0-9]{6}$/);
  });

  it("protege tokens de seguimiento", () => {
    expect(orderTokenHash("token")).toHaveLength(64);
    expect(orderTokenHash("token")).toBe(orderTokenHash("token"));
  });

  it("presenta estados y teléfonos", () => {
    expect(orderStatusLabel("preparing")).toBe("En preparación");
    expect(whatsappPhone("+54 (266) 123-4567")).toBe("542661234567");
  });
});
