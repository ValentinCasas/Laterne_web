/**
 * Navegación administrativa centralizada de MenuClick.
 *
 * Estructura por áreas funcionales con subgrupos claros:
 * - Inicio
 * - Atención (pedidos, cocina, clientes, reservas, cobros, facturación)
 * - Salón (plano interactivo, mesas, delivery)
 * - Productos (catálogo, producción, inventario)
 * - Compras (proveedores y gastos)
 * - Finanzas (operativa y reportes)
 * - Administración (negocio, acceso, config, análisis, datos)
 *
 * Cada entrada declara su ruta lógica, ícono, permiso y descripción breve.
 * El layout (AdminShell) consume esta definición, filtra por permisos y
 * convierte a URLs canónicas del tenant/sucursal.
 *
 * Solo se listan opciones cuya funcionalidad/route existe hoy en `app/admin`.
 */

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  permission: string;
  description?: string;
  /** @summary Oculta la opción para usuarios que no son súper admin (plataforma). */
  superAdminOnly?: boolean;
};

export type AdminNavSection = {
  id: string;
  label: string;
  items: readonly AdminNavItem[];
};

export type AdminNavGroup = {
  id: string;
  label: string;
  icon: string;
  description: string;
  sections: readonly AdminNavSection[];
};

export const ADMIN_NAVIGATION = [
  {
    id: "inicio",
    label: "Inicio",
    icon: "IN",
    description: "Resumen y puesta en marcha del negocio",
    sections: [
      {
        id: "panel",
        label: "Panel",
        items: [
          {
            href: "/admin",
            label: "Resumen",
            icon: "IN",
            permission: "admin.access",
            description: "Panorama general del negocio",
          },
          {
            href: "/admin/onboarding",
            label: "Puesta en marcha",
            icon: "OK",
            permission: "admin.access",
            description: "Configuración inicial del local",
          },
        ],
      },
    ],
  },
  {
    id: "atencion",
    label: "Atención",
    icon: "PE",
    description: "Pedidos, cocina, clientes y servicio al comensal",
    sections: [
      {
        id: "pedidos-cocina",
        label: "Pedidos y cocina",
        items: [
          {
            href: "/admin/pedidos",
            label: "Pedidos",
            icon: "PE",
            permission: "order.manage",
            description: "Administrá los pedidos del día",
          },
          {
            href: "/admin/cocina",
            label: "Cocina",
            icon: "CO",
            permission: "order.manage",
            description: "Preparaciones en curso",
          },
          {
            href: "/admin/impresion",
            label: "Impresión",
            icon: "IM",
            permission: "order.manage",
            description: "Áreas e impresoras de comandas",
          },
        ],
      },
      {
        id: "clientes-fidelizacion",
        label: "Clientes",
        items: [
          {
            href: "/admin/clientes",
            label: "Clientes",
            icon: "CL",
            permission: "customer.manage",
            description: "Base maestra de clientes",
          },
          {
            href: "/admin/clientes-frecuentes",
            label: "Clientes frecuentes",
            icon: "CF",
            permission: "customer.manage",
            description: "Fidelización y puntos de clientes habituales",
          },
          {
            href: "/admin/fidelizacion",
            label: "Programa de fidelización",
            icon: "FI",
            permission: "customer.manage",
            description: "Programa de puntos y recompensas",
          },
        ],
      },
      {
        id: "reservas-atencion",
        label: "Reservas",
        items: [
          {
            href: "/admin/reservas",
            label: "Reservas",
            icon: "RS",
            permission: "reservation.manage",
            description: "Confirmá y organizá reservas",
          },
        ],
      },
      {
        id: "cobros-atencion",
        label: "Cobros",
        items: [
          {
            href: "/admin/cobros",
            label: "Cuenta corriente",
            icon: "CC",
            permission: "customer.manage",
            description: "Pagos y saldo de clientes",
          },
        ],
      },
      {
        id: "facturacion-atencion",
        label: "Facturación",
        items: [
          {
            href: "/admin/facturacion",
            label: "Facturación",
            icon: "FC",
            permission: "order.manage",
            description: "Comprobantes y facturación",
          },
          {
            href: "/admin/configuracion/comprobantes/plantillas",
            label: "Plantillas de documentos",
            icon: "PL",
            permission: "order.manage",
            description: "Diseño de comprobantes",
          },
        ],
      },
    ],
  },
  {
    id: "salon",
    label: "Salón",
    icon: "SL",
    description: "Plano interactivo, mesas, sectores y delivery",
    sections: [
      {
        id: "salon-plano",
        label: "Plano",
        items: [
          {
            href: "/admin/salon",
            label: "Salón",
            icon: "SL",
            permission: "table.manage",
            description: "Plano de mesas, estados y consumos del salón",
          },
          {
            href: "/admin/mesas",
            label: "Mesas y QR",
            icon: "QR",
            permission: "table.manage",
            description: "Mesas, sectores y códigos QR",
          },
        ],
      },
      {
        id: "delivery-salon",
        label: "Delivery",
        items: [
          {
            href: "/admin/entregas",
            label: "Remitos y entregas",
            icon: "RE",
            permission: "order.manage",
            description: "Documento histórico de entregas",
          },
          {
            href: "/admin/delivery",
            label: "Centro de delivery",
            icon: "CD",
            permission: "order.manage",
            description: "Seguimiento de entregas y repartidores",
          },
          {
            href: "/admin/repartidores",
            label: "Repartidores",
            icon: "RP",
            permission: "driver.view",
            description: "Perfiles de repartidores, sucursales y KPIs",
          },
        ],
      },
    ],
  },
  {
    id: "catalogo",
    label: "Productos",
    icon: "PR",
    description: "Catálogo, producción, recetas e inventario",
    sections: [
      {
        id: "catalogo-productos",
        label: "Catálogo",
        items: [
          {
            href: "/admin/productos",
            label: "Productos",
            icon: "PR",
            permission: "product.manage",
            description: "Carta, precios y disponibilidad",
          },
          {
            href: "/admin/opciones-producto",
            label: "Variantes y extras",
            icon: "VX",
            permission: "product.manage",
            description: "Opciones y agregados por producto",
          },
        ],
      },
      {
        id: "produccion",
        label: "Producción",
        items: [
          {
            href: "/admin/ingredientes",
            label: "Ingredientes",
            icon: "IG",
            permission: "product.manage",
            description: "Costo, unidad y stock de la materia prima",
          },
          {
            href: "/admin/recetas",
            label: "Recetas",
            icon: "RE",
            permission: "product.manage",
            description: "Costos de recetas y ficha técnica imprimible",
          },
          {
            href: "/admin/inventario",
            label: "Inventario",
            icon: "IV",
            permission: "product.manage",
            description: "Stock, movimientos y conteos",
          },
        ],
      },
    ],
  },
  {
    id: "compras",
    label: "Compras",
    icon: "CO",
    description: "Pedidos, facturas y gastos a proveedores",
    sections: [
      {
        id: "compras-documentos",
        label: "Documentos",
        items: [
          {
            href: "/admin/compras/pedidos",
            label: "Pedidos de compra",
            icon: "OC",
            permission: "purchase.manage",
            description: "Pedidos de compra a proveedores",
          },
          {
            href: "/admin/compras/facturas",
            label: "Facturas de compra",
            icon: "FC",
            permission: "purchase.manage",
            description: "Facturas de compra y pagos a proveedores",
          },
        ],
      },
      {
        id: "gastos-compras",
        label: "Gastos",
        items: [
          {
            href: "/admin/gastos",
            label: "Gastos",
            icon: "GA",
            permission: "purchase.manage",
            description: "Gastos sin inventario y previsiones",
          },
        ],
      },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: "FI",
    description: "Cuentas, movimientos, flujo de caja y reportes",
    sections: [
      {
        id: "finanzas-operativa",
        label: "Operativa",
        items: [
          {
            href: "/admin/finanzas",
            label: "Resumen",
            icon: "FI",
            permission: "finance.view",
            description: "Panorama financiero del negocio",
          },
          {
            href: "/admin/finanzas/cuentas",
            label: "Cuentas",
            icon: "CU",
            permission: "finance.view",
            description: "Cuentas corrientes y bancarias",
          },
          {
            href: "/admin/finanzas/movimientos",
            label: "Movimientos",
            icon: "MO",
            permission: "finance.view",
            description: "Registro de movimientos financieros",
          },
          {
            href: "/admin/finanzas/flujo-caja",
            label: "Flujo de caja",
            icon: "FC",
            permission: "finance.view",
            description: "Entradas y salidas de efectivo",
          },
          {
            href: "/admin/finanzas/cuentas-cobrar",
            label: "Cuentas a cobrar",
            icon: "CC",
            permission: "finance.view",
            description: "Saldos pendientes de clientes",
          },
          {
            href: "/admin/finanzas/cuentas-pagar",
            label: "Cuentas a pagar",
            icon: "CP",
            permission: "finance.view",
            description: "Obligaciones pendientes con proveedores",
          },
          {
            href: "/admin/finanzas/estado-resultados",
            label: "Estado de resultados",
            icon: "ER",
            permission: "finance.view",
            description: "Ganancias, gastos y rentabilidad",
          },
        ],
      },
      {
        id: "reportes-finanzas",
        label: "Reportes",
        items: [
          {
            href: "/admin/reportes",
            label: "Resumen",
            icon: "RE",
            permission: "analytics.read",
            description: "KPIs generales y evolución",
          },
          {
            href: "/admin/reportes/ventas",
            label: "Ventas",
            icon: "VE",
            permission: "analytics.read",
            description: "Análisis de ventas, medios de pago y origen",
          },
          {
            href: "/admin/reportes/productos",
            label: "Productos",
            icon: "PR",
            permission: "analytics.read",
            description: "Popularidad, rentabilidad y CMV",
          },
          {
            href: "/admin/reportes/compras",
            label: "Compras",
            icon: "CO",
            permission: "analytics.read",
            description: "Evolución de costos y proveedores",
          },
          {
            href: "/admin/reportes/sucursales",
            label: "Sucursales",
            icon: "SU",
            permission: "analytics.read",
            description: "Comparativa entre sucursales",
          },
          {
            href: "/admin/reportes/consolidado",
            label: "Consolidado",
            icon: "CO",
            permission: "analytics.read",
            description: "Vista integral multi-sucursal del tenant",
          },
          {
            href: "/admin/reportes/ingenieria-menu",
            label: "Ingeniería de menú",
            icon: "IM",
            permission: "analytics.read",
            description: "Popularidad, rentabilidad y clasificación de productos",
          },
        ],
      },
    ],
  },
  {
    id: "administracion",
    label: "Administración",
    icon: "AD",
    description: "Configuración, acceso, análisis y datos del negocio",
    sections: [
      {
        id: "negocio",
        label: "Negocio",
        items: [
          {
            href: "/admin/marca",
            label: "Marca",
            icon: "BR",
            permission: "brand.manage",
            description: "Identidad y colores del negocio",
          },
          {
            href: "/admin/landing",
            label: "Portada",
            icon: "LN",
            permission: "brand.manage",
            description: "Landing y bienvenida",
          },
          {
            href: "/admin/carta",
            label: "Carta pública",
            icon: "CT",
            permission: "brand.manage",
            description: "Vista pública de la carta",
          },
          {
            href: "/admin/integraciones",
            label: "Integraciones",
            icon: "IG",
            permission: "business.manage",
            description: "Servicios y conexiones externas",
          },
          {
            href: "/admin/testimonios",
            label: "Testimonios",
            icon: "TE",
            permission: "testimonial.moderate",
            description: "Moderación de opiniones",
          },
        ],
      },
      {
        id: "sucursales-acceso",
        label: "Sucursales y acceso",
        items: [
          {
            href: "/admin/sucursales",
            label: "Sucursales",
            icon: "SU",
            permission: "business.manage",
            description: "Ubicación, geofencing y costos por local",
          },
          {
            href: "/admin/usuarios",
            label: "Usuarios",
            icon: "US",
            permission: "user.manage",
            description: "Equipo, roles y permisos",
          },
          {
            href: "/admin/planes",
            label: "Licencias",
            icon: "LI",
            permission: "admin.access",
            superAdminOnly: true,
            description: "Planes y licencias de la plataforma",
          },
        ],
      },
      {
        id: "configuracion",
        label: "Configuración",
        items: [
          {
            href: "/admin/notificaciones",
            label: "Notificaciones",
            icon: "NO",
            permission: "notification.manage",
            description: "Configuración de avisos",
          },
          {
            href: "/admin/soporte",
            label: "Soporte",
            icon: "SP",
            permission: "support.manage",
            description: "Centro de ayuda y soporte técnico",
          },
        ],
      },
      {
        id: "analisis",
        label: "Análisis",
        items: [
          {
            href: "/admin/estadisticas",
            label: "Estadísticas",
            icon: "AN",
            permission: "analytics.read",
            description: "Métricas de actividad y ventas",
          },
          {
            href: "/admin/auditoria",
            label: "Auditoría",
            icon: "AU",
            permission: "audit.read",
            description: "Historial de acciones sensibles",
          },
          {
            href: "/admin/errores",
            label: "Registro de errores",
            icon: "ER",
            permission: "audit.read",
            description: "Errores y fallas del panel",
          },
        ],
      },
      {
        id: "datos",
        label: "Datos",
        items: [
          {
            href: "/admin/archivos",
            label: "Archivos",
            icon: "MD",
            permission: "media.manage",
            description: "Imágenes y modelos 3D",
          },
          {
            href: "/admin/datos",
            label: "Importar / exportar",
            icon: "DT",
            permission: "admin.access",
            description: "Copia de seguridad de datos",
          },
          {
            href: "/admin/busqueda",
            label: "Búsqueda global",
            icon: "BS",
            permission: "admin.access",
            description: "Buscar en todo el negocio",
          },
        ],
      },
      {
        id: "recepcionista-ia",
        label: "Recepcionista IA",
        items: [
          {
            href: "/admin/recepcionista-ia",
            label: "Configuración",
            icon: "RA",
            permission: "business.manage",
            description: "Base de conocimiento y comportamiento de la asistente virtual",
          },
        ],
      },
    ],
  },
] as const satisfies readonly AdminNavGroup[];

export function adminNavLinks(): AdminNavItem[] {
  return ADMIN_NAVIGATION.flatMap((group) => group.sections.flatMap((section) => [...section.items]));
}

export function adminGroupsForPermissions(
  permissions: readonly string[],
  roleKey?: string,
  isSuperAdmin = false,
): AdminNavGroup[] {
  const privilegedFinance = roleKey === "owner" || roleKey === "administrator";
  return ADMIN_NAVIGATION.flatMap((group) => {
    const sections = group.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if ("superAdminOnly" in item && item.superAdminOnly && !isSuperAdmin) return false;
          if (privilegedFinance && item.permission.startsWith("finance.")) return true;
          return permissions.includes(item.permission);
        }),
      }))
      .filter((section) => section.items.length > 0);
    return sections.length > 0 ? [{ ...group, sections }] : [];
  });
}

export function adminGroupIdForHref(href: string): string {
  const group = ADMIN_NAVIGATION.find((candidate) =>
    candidate.sections.some((section) => section.items.some((item) => item.href === href)),
  );
  return group?.id ?? ADMIN_NAVIGATION[0]?.id ?? "inicio";
}

export function adminLinkMatchScore(pathname: string, href: string): number {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const normalizedHref = href.replace(/\/+$/, "") || "/";
  const hrefSegments = normalizedHref.split("/").filter(Boolean);
  if (hrefSegments.length === 1 && hrefSegments[0] === "admin") {
    const pathSegments = normalizedPath.split("/").filter(Boolean);
    const last = pathSegments[pathSegments.length - 1];
    const prev = pathSegments[pathSegments.length - 2];
    return last === "admin" && prev !== "s" ? 1 : 0;
  }
  // El enlace se activa cuando es un prefijo completo del pathname (límites de segmento).
  if (normalizedPath === normalizedHref) return hrefSegments.length;
  if (!normalizedPath.startsWith(normalizedHref)) return 0;
  if (normalizedPath.charAt(normalizedHref.length) !== "/") return 0;
  return hrefSegments.length;
}

export function findActiveAdminLink(
  groups: readonly Pick<AdminNavGroup, "sections">[],
  pathname: string,
): AdminNavItem | null {
  let best: AdminNavItem | null = null;
  let bestScore = 0;
  for (const group of groups) {
    for (const section of group.sections) {
      for (const item of section.items) {
        const score = adminLinkMatchScore(pathname, item.href);
        if (
          score > bestScore ||
          (score > 0 && score === bestScore && item.href.length > (best?.href.length ?? 0))
        ) {
          best = item;
          bestScore = score;
        }
      }
    }
  }
  return best;
}
