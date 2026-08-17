import { describe, expect, it } from "vitest";
import {
  adminGroupsForPermissions,
  adminGroupIdForHref,
  adminLinkMatchScore,
  adminNavLinks,
  ADMIN_NAVIGATION,
  findActiveAdminLink,
} from "@/lib/admin-navigation";

describe("definición centralizada de navegación administrativa", () => {
  it("declara solo rutas que existen en app/admin", () => {
    const known = new Set([
      "/admin",
      "/admin/onboarding",
      "/admin/pedidos",
      "/admin/cocina",
      "/admin/impresion",
      "/admin/salon",
      "/admin/reservas",
      "/admin/mesas",
      "/admin/facturacion",
      "/admin/configuracion/comprobantes/plantillas",
      "/admin/clientes-frecuentes",
      "/admin/fidelizacion",
      "/admin/productos",
      "/admin/opciones-producto",
      "/admin/ingredientes",
      "/admin/recetas",
      "/admin/inventario",
      "/admin/compras",
      "/admin/gastos",
      "/admin/marca",
      "/admin/landing",
      "/admin/carta",
      "/admin/integraciones",
      "/admin/estadisticas",
      "/admin/auditoria",
      "/admin/errores",
      "/admin/notificaciones",
      "/admin/archivos",
      "/admin/datos",
      "/admin/busqueda",
      "/admin/testimonios",
      "/admin/soporte",
      "/admin/cuenta",
    ]);
    for (const link of adminNavLinks()) {
      expect(known.has(link.href), `ruta inexistente: ${link.href}`).toBe(true);
      expect(link.permission.length).toBeGreaterThan(0);
    }
  });

  it("cada grupo y sección tiene identificadores únicos", () => {
    const groupIds = new Set<string>();
    const sectionIds = new Set<string>();
    for (const group of ADMIN_NAVIGATION) {
      expect(groupIds.has(group.id)).toBe(false);
      groupIds.add(group.id);
      for (const section of group.sections) {
        expect(sectionIds.has(section.id), `sección duplicada: ${section.id}`).toBe(false);
        sectionIds.add(section.id);
      }
    }
  });

  it("filtra entradas por permisos sin dejar grupos vacíos", () => {
    const filtered = adminGroupsForPermissions(["admin.access", "order.manage"]);
    const labels = filtered.flatMap((group) =>
      group.sections.flatMap((section) => section.items.map((i) => i.label)),
    );
    expect(labels).toContain("Pedidos");
    expect(labels).not.toContain("Productos");
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("localiza el grupo correcto de una ruta", () => {
    expect(adminGroupIdForHref("/admin/pedidos")).toBe("operacion");
    expect(adminGroupIdForHref("/admin/productos")).toBe("productos");
    expect(adminGroupIdForHref("/admin/compras")).toBe("operacion");
    expect(adminGroupIdForHref("/admin/inventario")).toBe("productos");
    expect(adminGroupIdForHref("/admin/marca")).toBe("administracion");
    expect(adminGroupIdForHref("/admin/estadisticas")).toBe("administracion");
  });
});

describe("resaltado de ruta activa del panel", () => {
  it("marca el inicio solo con coincidencia exacta", () => {
    expect(adminLinkMatchScore("/admin", "/admin")).toBe(1);
    expect(adminLinkMatchScore("/admin/pedidos", "/admin")).toBe(0);
  });

  it("activa un enlace en sus rutas anidadas", () => {
    expect(adminLinkMatchScore("/admin/pedidos", "/admin/pedidos")).toBe(2);
    expect(adminLinkMatchScore("/admin/pedidos/123", "/admin/pedidos")).toBe(2);
    expect(adminLinkMatchScore("/admin/facturacion/45", "/admin/facturacion")).toBe(2);
  });

  it("no activa por prefijo de texto: /admin/productos vs /admin/productos-nuevos", () => {
    expect(adminLinkMatchScore("/admin/productos-nuevos", "/admin/productos")).toBe(0);
    expect(adminLinkMatchScore("/admin/productos", "/admin/productos")).toBe(2);
  });

  it("no activa secciones hermanas ni el inicio en subrutas", () => {
    expect(adminLinkMatchScore("/admin/cocina", "/admin/pedidos")).toBe(0);
    expect(adminLinkMatchScore("/admin/pedidos/123", "/admin")).toBe(0);
  });

  it("devuelve una sola entrada activa y gana la más específica", () => {
    const groups = adminGroupsForPermissions([
      "admin.access",
      "order.manage",
      "product.manage",
      "purchase.manage",
    ]);
    const active = findActiveAdminLink(groups, "/admin/configuracion/comprobantes/plantillas");
    expect(active?.href).toBe("/admin/configuracion/comprobantes/plantillas");

    const onOrders = findActiveAdminLink(groups, "/admin/pedidos/987");
    expect(onOrders?.href).toBe("/admin/pedidos");
    expect(onOrders?.label).toBe("Pedidos");
  });

  it("no marca ninguna opción para rutas desconocidas", () => {
    const groups = adminGroupsForPermissions(["admin.access"]);
    expect(findActiveAdminLink(groups, "/admin/inexistente")).toBeNull();
    expect(findActiveAdminLink(groups, "/admin")).not.toBeNull();
  });
});
