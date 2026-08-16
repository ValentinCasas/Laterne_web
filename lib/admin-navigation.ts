/**
 * Navegación administrativa centralizada de MenuClick.
 *
 * Única fuente de verdad para el menú del panel: cada entrada declara su ruta
 * lógica, su ícono y el permiso real que habilita su visibilidad. El layout
 * (AdminShell) solo consume esta definición, la filtra por permisos y la
 * convierte a URLs canónicas del tenant/sucursal.
 *
 * Solo se listan opciones cuya funcionalidad/ruta existe hoy en `app/admin`.
 * Las categorías conceptuales de referencia (Compras, Finanzas, etc.) se
 * agregan aquí cuando sus páginas existan, sin tocar los componentes.
 */

export type AdminNavItem = {
  /** Ruta lógica `/admin/...` que el shell traduce a la URL canónica. */
  href: string;
  label: string;
  /** Marca corta de dos caracteres usada como ícono. */
  icon: string;
  /** Permiso requerido para ver la opción. */
  permission: string;
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
          { href: "/admin", label: "Resumen", icon: "IN", permission: "admin.access" },
          { href: "/admin/onboarding", label: "Puesta en marcha", icon: "OK", permission: "admin.access" },
        ],
      },
    ],
  },
  {
    id: "operacion",
    label: "Operación",
    icon: "OP",
    description: "Atención, facturación y clientes del día a día",
    sections: [
      {
        id: "atencion",
        label: "Atención",
        items: [
          { href: "/admin/pedidos", label: "Pedidos", icon: "PE", permission: "order.manage" },
          { href: "/admin/cocina", label: "Cocina", icon: "CO", permission: "order.manage" },
          { href: "/admin/reservas", label: "Reservas", icon: "RS", permission: "reservation.manage" },
          { href: "/admin/mesas", label: "Mesas y QR", icon: "QR", permission: "table.manage" },
        ],
      },
      {
        id: "facturacion",
        label: "Facturación",
        items: [
          { href: "/admin/facturacion", label: "Facturación", icon: "FC", permission: "order.manage" },
          {
            href: "/admin/configuracion/comprobantes/plantillas",
            label: "Plantillas de documentos",
            icon: "PL",
            permission: "order.manage",
          },
        ],
      },
      {
        id: "clientes",
        label: "Clientes",
        items: [
          {
            href: "/admin/clientes-frecuentes",
            label: "Clientes frecuentes",
            icon: "CF",
            permission: "customer.manage",
          },
          { href: "/admin/fidelizacion", label: "Fidelización", icon: "FI", permission: "customer.manage" },
        ],
      },
    ],
  },
  {
    id: "carta",
    label: "Carta",
    icon: "CA",
    description: "Catálogo, promociones y contenido de la carta",
    sections: [
      {
        id: "catalogo",
        label: "Catálogo",
        items: [
          { href: "/admin/productos", label: "Productos", icon: "PR", permission: "product.manage" },
          {
            href: "/admin/opciones-producto",
            label: "Variantes y extras",
            icon: "VX",
            permission: "product.manage",
          },
          { href: "/admin/categorias", label: "Categorías", icon: "CA", permission: "category.manage" },
        ],
      },
      {
        id: "comercial",
        label: "Comercial",
        items: [
          { href: "/admin/promociones", label: "Promociones", icon: "PM", permission: "promotion.manage" },
          { href: "/admin/eventos", label: "Eventos", icon: "EV", permission: "event.manage" },
          { href: "/admin/horarios", label: "Horarios", icon: "HO", permission: "hours.manage" },
        ],
      },
      {
        id: "comunidad",
        label: "Comunidad",
        items: [
          {
            href: "/admin/testimonios",
            label: "Testimonios",
            icon: "TE",
            permission: "testimonial.moderate",
          },
        ],
      },
    ],
  },
  {
    id: "presencia",
    label: "Marca",
    icon: "BR",
    description: "Identidad, posicionamiento y presencia pública",
    sections: [
      {
        id: "identidad",
        label: "Identidad",
        items: [
          { href: "/admin/negocio", label: "Negocio", icon: "NE", permission: "business.manage" },
          { href: "/admin/marca", label: "Marca", icon: "BR", permission: "brand.manage" },
          { href: "/admin/landing", label: "Portada", icon: "LN", permission: "brand.manage" },
          { href: "/admin/carta", label: "Carta", icon: "CT", permission: "brand.manage" },
        ],
      },
      {
        id: "posicionamiento",
        label: "Posicionamiento",
        items: [
          { href: "/admin/seo", label: "SEO", icon: "SE", permission: "business.manage" },
          { href: "/admin/redirecciones", label: "Redirecciones", icon: "RD", permission: "business.manage" },
        ],
      },
      {
        id: "extension",
        label: "Extensión",
        items: [
          { href: "/admin/integraciones", label: "Integraciones", icon: "IG", permission: "business.manage" },
          { href: "/admin/legales", label: "Páginas legales", icon: "LG", permission: "content.manage" },
          { href: "/admin/casos", label: "Casos de éxito", icon: "CX", permission: "content.manage" },
        ],
      },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    icon: "GE",
    description: "Análisis, equipo y datos del negocio",
    sections: [
      {
        id: "analisis",
        label: "Análisis",
        items: [
          { href: "/admin/estadisticas", label: "Estadísticas", icon: "AN", permission: "analytics.read" },
          { href: "/admin/auditoria", label: "Auditoría", icon: "AU", permission: "audit.read" },
          { href: "/admin/errores", label: "Registro de errores", icon: "ER", permission: "audit.read" },
        ],
      },
      {
        id: "equipo",
        label: "Equipo",
        items: [
          { href: "/admin/usuarios", label: "Usuarios", icon: "US", permission: "user.manage" },
          {
            href: "/admin/notificaciones",
            label: "Notificaciones",
            icon: "NO",
            permission: "notification.manage",
          },
        ],
      },
      {
        id: "datos",
        label: "Datos y archivos",
        items: [
          { href: "/admin/archivos", label: "Archivos", icon: "MD", permission: "media.manage" },
          { href: "/admin/datos", label: "Importar / exportar", icon: "DT", permission: "admin.access" },
          { href: "/admin/busqueda", label: "Búsqueda global", icon: "BS", permission: "admin.access" },
        ],
      },
    ],
  },
  {
    id: "ayuda",
    label: "Ayuda",
    icon: "AY",
    description: "Asistencia, soporte y cuenta",
    sections: [
      {
        id: "asistencia",
        label: "Asistencia",
        items: [
          { href: "/admin/ayuda", label: "Centro de ayuda", icon: "AY", permission: "content.manage" },
          { href: "/admin/soporte", label: "Soporte", icon: "SO", permission: "support.manage" },
        ],
      },
      {
        id: "cuenta",
        label: "Cuenta",
        items: [{ href: "/admin/cuenta", label: "Mi cuenta", icon: "MC", permission: "admin.access" }],
      },
    ],
  },
] as const satisfies readonly AdminNavGroup[];

/** @summary Devuelve todas las entradas de navegación en un único arreglo plano. */
export function adminNavLinks(): AdminNavItem[] {
  return ADMIN_NAVIGATION.flatMap((group) => group.sections.flatMap((section) => [...section.items]));
}

/** @summary Filtra los grupos por los permisos reales de la membresía activa. */
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

/** @summary Localiza el grupo que contiene una ruta (para abrir el panel correcto). */
export function adminGroupIdForHref(href: string): string {
  const group = ADMIN_NAVIGATION.find((candidate) =>
    candidate.sections.some((section) => section.items.some((item) => item.href === href)),
  );
  return group?.id ?? ADMIN_NAVIGATION[0]?.id ?? "inicio";
}

/**
 * @summary Puntaje de coincidencia entre una ruta lógica visible y un enlace.
 *
 * Comparación por segmentos: el enlace debe ser prefijo exacto de segmentos de
 * la ruta (evita que `/admin/productos` ilumine `/admin/productos-nuevos`).
 * `/admin` solo coincide con coincidencia exacta. Mayor profundidad = mayor
 * puntaje, de modo que de todos los candidatos gana uno solo.
 */
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

/**
 * @summary Devuelve la ÚNICA entrada activa para la ruta visible, o null.
 *
 * Si dos enlaces compiten (uno prefijo del otro), gana el de mayor profundidad
 * y, en empate, el de href más largo. Garantiza una sola opción activa.
 */
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
