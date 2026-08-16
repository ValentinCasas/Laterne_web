import { describe, expect, it } from "vitest";
import {
  adminHrefForContext,
  parseCanonicalPath,
  platformAdminPath,
  platformBranchPath,
  platformClientPath,
  publicHrefForContext,
  publicHrefForVisiblePath,
  scopedApiPath,
  switchAdminBranchPath,
  tenantAdminGuidPath,
  tenantAdminPath,
  tenantBranchAdminGuidPath,
  tenantBranchAdminPath,
  tenantBranchPublicPath,
  tenantPublicPath,
} from "@/lib/routes";

const GUID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

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

  it("construye URLs administrativas canónicas con identidad por GUID", () => {
    expect(tenantAdminGuidPath(GUID, "Laterne", "/admin/usuarios")).toBe(
      `/t/${GUID}/laterne/admin/usuarios`,
    );
    expect(tenantBranchAdminGuidPath(GUID, "Laterne", "Principal", "/admin/pedidos")).toBe(
      `/t/${GUID}/laterne/admin/s/principal/pedidos`,
    );
    expect(platformClientPath(GUID, "Laterne")).toBe(`/platform/clientes/${GUID}/laterne`);
    expect(platformBranchPath(GUID, "Laterne", "Principal")).toBe(
      `/platform/clientes/${GUID}/laterne/sucursales/principal`,
    );
  });

  it("parsea las URLs canónicas con GUID administrativas y de Platform", () => {
    expect(parseCanonicalPath(`/t/${GUID}/laterne/admin/s/principal/pedidos`)).toEqual({
      surface: "tenant-admin",
      tenantGuid: GUID,
      tenantSlug: "laterne",
      branchSlug: "principal",
      logicalPath: "/admin/pedidos",
    });
    expect(parseCanonicalPath(`/t/${GUID}/laterne/admin/usuarios`)).toEqual({
      surface: "tenant-admin",
      tenantGuid: GUID,
      tenantSlug: "laterne",
      logicalPath: "/admin/usuarios",
    });
    expect(parseCanonicalPath(`/platform/clientes/${GUID}/laterne`)).toEqual({
      surface: "platform-admin",
      tenantGuid: GUID,
      tenantSlug: "laterne",
      logicalPath: `/superadmin/clientes/${GUID}/laterne`,
    });
    expect(parseCanonicalPath(`/platform/clientes/${GUID}/laterne/sucursales/principal`)).toEqual({
      surface: "platform-admin",
      tenantGuid: GUID,
      tenantSlug: "laterne",
      branchSlug: "principal",
      logicalPath: `/superadmin/clientes/${GUID}/laterne/sucursales/principal`,
    });
  });

  it("mantiene las URLs legadas por slug y preserva el GUID cuando está presente", () => {
    expect(parseCanonicalPath("/t/laterne/admin/usuarios").tenantGuid).toBeUndefined();
    expect(parseCanonicalPath("/platform/clientes/laterne").logicalPath).toBe(
      "/superadmin/clientes/laterne",
    );
    expect(adminHrefForContext("laterne", "/admin/pedidos", "laterne-2", GUID)).toBe(
      `/t/${GUID}/laterne/admin/s/laterne-2/pedidos`,
    );
    expect(adminHrefForContext("laterne", "/admin/usuarios", "laterne-2", GUID)).toBe(
      `/t/${GUID}/laterne/admin/usuarios`,
    );
  });

  it("scopea APIs al contexto visible con GUID", () => {
    expect(scopedApiPath(`/t/${GUID}/laterne/admin/pedidos`, "/api/admin/orders/8")).toBe(
      `/api/t/${GUID}/laterne/admin/orders/8`,
    );
    expect(scopedApiPath(`/t/${GUID}/laterne/admin/s/principal/pedidos`, "/api/admin/orders/8")).toBe(
      `/api/t/${GUID}/laterne/admin/s/principal/orders/8`,
    );
    expect(scopedApiPath(`/platform/clientes/${GUID}/laterne`, "/api/superadmin/clients")).toBe(
      "/api/platform/clients",
    );
  });

  it("cambiar branch conserva la identidad por GUID", () => {
    expect(switchAdminBranchPath(`/t/${GUID}/laterne/admin/s/principal/pedidos`, "laterne-2")).toBe(
      `/t/${GUID}/laterne/admin/s/laterne-2/pedidos`,
    );
    expect(switchAdminBranchPath(`/t/${GUID}/laterne/admin/s/principal/pedidos`)).toBe(
      `/t/${GUID}/laterne/admin/pedidos`,
    );
  });
});
