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
      "/admin/compras/pedidos",
      "/admin/compras/facturas",
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
      "/admin/sucursales",
      "/admin/usuarios",
      "/admin/planes",
      "/admin/entregas",
      "/admin/delivery",
      "/admin/repartidores",
      "/admin/driver",
      "/admin/cobros",
      "/admin/clientes",
      "/admin/finanzas",
      "/admin/finanzas/cuentas",
      "/admin/finanzas/movimientos",
      "/admin/finanzas/flujo-caja",
      "/admin/finanzas/cuentas-cobrar",
      "/admin/finanzas/cuentas-pagar",
      "/admin/finanzas/estado-resultados",
      "/admin/reportes",
      "/admin/reportes/ventas",
      "/admin/reportes/productos",
      "/admin/reportes/compras",
      "/admin/reportes/sucursales",
      "/admin/reportes/consolidado",
      "/admin/reportes/ingenieria-menu",
      "/admin/recepcionista-ia",
    ]);
    for (const link of adminNavLinks()) {
      const pathname = link.href.split(/[?#]/, 1)[0] ?? link.href;
      expect(known.has(pathname), `ruta inexistente: ${link.href}`).toBe(true);
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
    expect(labels).toContain("Panel del repartidor");
    expect(labels).not.toContain("Productos");
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("mantiene visible y accesible el panel personal sin un permiso específico", () => {
    const filtered = adminGroupsForPermissions([
      "admin.access",
      "order.manage",
      "driver.view",
      "business.manage",
    ]);
    const delivery = filtered.find((group) => group.id === "delivery");
    expect(delivery?.sections.flatMap((section) => section.items.map((item) => item.label))).toEqual([
      "Centro de delivery",
      "Repartidores",
      "Panel del repartidor",
      "Configuración de delivery",
    ]);
    const panel = delivery?.sections.flatMap((section) => section.items).find((item) => item.href === "/admin/driver");
    expect(panel?.accessPermission).toBeUndefined();
  });

  it("localiza el grupo correcto de una ruta", () => {
    expect(adminGroupIdForHref("/admin/pedidos")).toBe("atencion");
    expect(adminGroupIdForHref("/admin/productos")).toBe("catalogo");
    expect(adminGroupIdForHref("/admin/compras/pedidos")).toBe("compras");
    expect(adminGroupIdForHref("/admin/inventario")).toBe("catalogo");
    expect(adminGroupIdForHref("/admin/marca")).toBe("administracion");
    expect(adminGroupIdForHref("/admin/sucursales")).toBe("administracion");
    expect(adminGroupIdForHref("/admin/usuarios")).toBe("administracion");
    expect(adminGroupIdForHref("/admin/planes")).toBe("administracion");
    expect(adminGroupIdForHref("/admin/estadisticas")).toBe("administracion");
    expect(adminGroupIdForHref("/admin/delivery")).toBe("delivery");
    expect(adminGroupIdForHref("/admin/repartidores")).toBe("delivery");
    expect(adminGroupIdForHref("/admin/driver")).toBe("delivery");
    expect(adminGroupIdForHref("/admin/integraciones#delivery-map")).toBe("delivery");
    expect(adminGroupIdForHref("/admin/finanzas")).toBe("finanzas");
    expect(adminGroupIdForHref("/admin/finanzas/cuentas")).toBe("finanzas");
    expect(adminGroupIdForHref("/admin/finanzas/movimientos")).toBe("finanzas");
    expect(adminGroupIdForHref("/admin/finanzas/flujo-caja")).toBe("finanzas");
    expect(adminGroupIdForHref("/admin/finanzas/cuentas-cobrar")).toBe("finanzas");
    expect(adminGroupIdForHref("/admin/finanzas/cuentas-pagar")).toBe("finanzas");
    expect(adminGroupIdForHref("/admin/finanzas/estado-resultados")).toBe("finanzas");
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
    expect(adminLinkMatchScore("/admin/integraciones", "/admin/integraciones#delivery-map")).toBe(0);
    expect(adminLinkMatchScore("/admin/integraciones#delivery-map", "/admin/integraciones#delivery-map")).toBe(2);
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

    const deliveryGroups = adminGroupsForPermissions(["admin.access", "business.manage"]);
    const onDeliverySettings = findActiveAdminLink(deliveryGroups, "/admin/integraciones#delivery-map");
    expect(onDeliverySettings?.label).toBe("Configuración de delivery");

    const onGenericIntegrations = findActiveAdminLink(deliveryGroups, "/admin/integraciones");
    expect(onGenericIntegrations?.label).toBe("Integraciones");
  });

  it("no marca ninguna opción para rutas desconocidas", () => {
    const groups = adminGroupsForPermissions(["admin.access"]);
    expect(findActiveAdminLink(groups, "/admin/inexistente")).toBeNull();
    expect(findActiveAdminLink(groups, "/admin")).not.toBeNull();
  });
});
