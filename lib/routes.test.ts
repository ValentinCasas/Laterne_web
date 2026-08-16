import { describe, expect, it } from "vitest";
import {
  adminHrefForContext,
  parseCanonicalPath,
  platformAdminPath,
  publicHrefForContext,
  publicHrefForVisiblePath,
  scopedApiPath,
  switchAdminBranchPath,
  tenantAdminPath,
  tenantBranchAdminPath,
  tenantBranchPublicPath,
  tenantPublicPath,
} from "@/lib/routes";

describe("routing canónico de MenuClick", () => {
  it("hace explícitos tenant y branch en URLs públicas", () => {
    expect(tenantPublicPath("Laterne", "/carta")).toBe("/t/laterne/carta");
    expect(tenantBranchPublicPath("Laterne", "Laterne-2", "/carta")).toBe("/t/laterne/s/laterne-2/carta");
  });

  it("hace explícitos tenant y branch en URLs administrativas", () => {
    expect(tenantAdminPath("Laterne", "/admin/usuarios")).toBe("/t/laterne/admin/usuarios");
    expect(tenantBranchAdminPath("Laterne", "Principal", "/admin/pedidos")).toBe(
      "/t/laterne/admin/s/principal/pedidos",
    );
    expect(platformAdminPath("/superadmin/clientes")).toBe("/platform/clientes");
  });

  it("interpreta rutas sin depender del host ni de branchId", () => {
    expect(parseCanonicalPath("/t/laterne/admin/s/principal/pedidos")).toEqual({
      surface: "tenant-admin",
      tenantSlug: "laterne",
      branchSlug: "principal",
      logicalPath: "/admin/pedidos",
    });
    expect(parseCanonicalPath("/t/soderia/carta")).toEqual({
      surface: "tenant-public",
      tenantSlug: "soderia",
      logicalPath: "/carta",
    });
  });

  it("preserva branch solamente en módulos branch-scoped", () => {
    expect(adminHrefForContext("laterne", "/admin/pedidos", "laterne-2")).toBe(
      "/t/laterne/admin/s/laterne-2/pedidos",
    );
    expect(adminHrefForContext("laterne", "/admin/usuarios", "laterne-2")).toBe("/t/laterne/admin/usuarios");
  });

  it("preserva query/hash sin perder branch", () => {
    expect(publicHrefForContext("laterne", "/pedido?mesa=M1#confirmar", "principal")).toBe(
      "/t/laterne/s/principal/pedido?mesa=M1#confirmar",
    );
    expect(adminHrefForContext("laterne", "/admin/estadisticas?days=30", "principal")).toBe(
      "/t/laterne/admin/s/principal/estadisticas?days=30",
    );
  });

  it("mantiene dominios personalizados planos y conserva branch donde corresponde", () => {
    expect(publicHrefForVisiblePath("/carta", "laterne", "/pedido", "principal")).toBe("/s/principal/pedido");
    expect(publicHrefForVisiblePath("/t/laterne/s/principal/carta", "laterne", "/pedido", "principal")).toBe(
      "/t/laterne/s/principal/pedido",
    );
    expect(publicHrefForVisiblePath("/s/principal/carta", "laterne", "/ayuda", "principal")).toBe("/ayuda");
  });

  it("scopea APIs al contexto visible", () => {
    expect(scopedApiPath("/t/laterne/admin/s/laterne-2/pedidos", "/api/admin/orders/8")).toBe(
      "/api/t/laterne/admin/s/laterne-2/orders/8",
    );
    expect(scopedApiPath("/t/laterne/s/laterne-2/carta", "/api/orders")).toBe(
      "/api/t/laterne/s/laterne-2/orders",
    );
    expect(scopedApiPath("/platform/clientes", "/api/superadmin/clients")).toBe("/api/platform/clients");
    expect(scopedApiPath("/platform/oportunidades", "/api/admin/leads/12")).toBe("/api/platform/leads/12");
    expect(scopedApiPath("/t/laterne/admin/oportunidades", "/api/admin/leads/12")).toBe(
      "/api/t/laterne/admin/leads/12",
    );
  });

  it("cambiar branch conserva el módulo y no usa query branchId", () => {
    expect(switchAdminBranchPath("/t/laterne/admin/s/principal/pedidos", "laterne-2")).toBe(
      "/t/laterne/admin/s/laterne-2/pedidos",
    );
    expect(switchAdminBranchPath("/t/laterne/admin/s/principal/pedidos")).toBe("/t/laterne/admin/pedidos");
  });
});
