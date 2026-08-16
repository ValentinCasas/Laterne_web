import { describe, expect, it } from "vitest";
import { isPlatformLinkActive } from "@/lib/navigation-active";

describe("resaltado del sidebar de MenuClick Platform", () => {
  it("marca el inicio solo con coincidencia exacta", () => {
    expect(isPlatformLinkActive("/platform", "/platform")).toBe(true);
    expect(isPlatformLinkActive("/platform", "/platform/clientes")).toBe(false);
  });

  it("mantiene Clientes activo en los detalles por GUID", () => {
    expect(isPlatformLinkActive("/platform/clientes", "/platform/clientes")).toBe(true);
    expect(
      isPlatformLinkActive(
        "/platform/clientes",
        "/platform/clientes/f47ac10b-58cc-4372-a567-0e02b2c3d479/laterne",
      ),
    ).toBe(true);
    expect(
      isPlatformLinkActive(
        "/platform/clientes",
        "/platform/clientes/f47ac10b-58cc-4372-a567-0e02b2c3d479/laterne/sucursales/principal",
      ),
    ).toBe(true);
  });

  it("excluye el formulario de alta nuevo", () => {
    expect(isPlatformLinkActive("/platform/clientes", "/platform/clientes/nuevo")).toBe(false);
    expect(isPlatformLinkActive("/platform/clientes/nuevo", "/platform/clientes/nuevo")).toBe(true);
  });

  it("marca las demás secciones por prefijo de segmento", () => {
    expect(isPlatformLinkActive("/platform/pagos", "/platform/pagos")).toBe(true);
    expect(isPlatformLinkActive("/platform/auditoria", "/platform/auditoria/123")).toBe(true);
    expect(isPlatformLinkActive("/platform/pagos", "/platform/suscripciones")).toBe(false);
  });
});