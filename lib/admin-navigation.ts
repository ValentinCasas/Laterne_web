/**
 * Navegación administrativa centralizada de MenuClick.
 *
 * Estructura por áreas funcionales:
 * - Inicio
 * - Operación
 * - Productos
 * - Administración
 *
 * Cada entrada declara su ruta lógica, ícono, permiso y descripción breve.
 * El layout (AdminShell) consume esta definición, filtra por permisos y
 * convierte a URLs canónicas del tenant/sucursal.
 *
 * Solo se listan opciones cuya funcionalidad/ruta existe hoy en `app/admin`.
 */

export type AdminNavItem = {
  href: string;
  label: string;
  icon: string;
  permission: string;
  description?: string;
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
    id: "operacion",
    label: "Operación",
    icon: "OP",
    description: "Pedidos, atención, clientes y facturación del día a día",
    sections: [
      {
        id: "ventas",
        label: "Ventas y atención",
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
        id: "clientes",
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
            href: "/admin/fidelizacion",
            label: "Fidelización",
            icon: "FI",
            permission: "customer.manage",
            description: "Programa de puntos y recompensas",
          },
        ],
      },
      {
        id: "reservas",
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
        id: "entregas",
        label: "Entregas",
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
      {
        id: "cobros",
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
        id: "compras",
        label: "Compras",
        items: [
          {
            href: "/admin/compras",
            label: "Compras",
            icon: "CO",
            permission: "purchase.manage",
            description: "Pedidos, recepciones y facturas de proveedores",
          },
          {
            href: "/admin/gastos",
            label: "Gastos",
            icon: "GA",
            permission: "purchase.manage",
            description: "Gastos sin inventario y previsiones",
          },
        ],
      },
      {
        id: "facturacion",
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
    id: "productos",
    label: "Productos",
    icon: "PR",
    description: "Catálogo, precios, producción e inventario",
    sections: [
      {
        id: "catalogo",
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
        ],
      },
      {
        id: "inventario",
        label: "Inventario",
        items: [
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
    id: "administracion",
    label: "Administración",
    icon: "AD",
    description: "Configuración, análisis y datos del negocio",
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
    ],
  },
] as const satisfies readonly AdminNavGroup[];

export function adminNavLinks(): AdminNavItem[] {
  return ADMIN_NAVIGATION.flatMap((group) => group.sections.flatMap((section) => [...section.items]));
}

export function adminGroupsForPermissions(permissions: readonly string[]): AdminNavGroup[] {
  return ADMIN_NAVIGATION.flatMap((group) => {
    const sections = group.sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => permissions.includes(item.permission)),
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
  const pathSegments = pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  const hrefSegments = href.replace(/\/+$/, "").split("/").filter(Boolean);
  if (hrefSegments.length === 1 && hrefSegments[0] === "admin") {
    return pathSegments.length === 1 && pathSegments[0] === "admin" ? 1 : 0;
  }
  if (pathSegments.length < hrefSegments.length) return 0;
  for (let index = 0; index < hrefSegments.length; index++) {
    if (pathSegments[index] !== hrefSegments[index]) return 0;
  }
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
