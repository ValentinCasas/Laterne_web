/**
 * Navegación administrativa centralizada de MenuClick.
 *
 * Única fuente de verdad para el menú del panel: cada entrada declara su ruta
 * lógica, su ícono, el permiso real que habilita su visibilidad y una
 * descripción breve para los paneles amplios. El layout (AdminShell) solo
 * consume esta definición, la filtra por permisos y la convierte a URLs
 * canónicas del tenant/sucursal.
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
  /** Descripción breve mostrada en los paneles amplios del mega menú. */
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
    description: "Atención, facturación y clientes del día a día",
    sections: [
      {
        id: "atencion",
        label: "Atención",
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
            description: "Áreas e impresoras de comandas (preparación)",
          },
          {
            href: "/admin/salon",
            label: "Salón",
            icon: "SL",
            permission: "table.manage",
            description: "Plano de mesas, estados y consumos del salón",
          },
          {
            href: "/admin/reservas",
            label: "Reservas",
            icon: "RS",
            permission: "reservation.manage",
            description: "Confirmá y organizá reservas",
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
      {
        id: "clientes",
        label: "Clientes",
        items: [
          {
            href: "/admin/clientes-frecuentes",
            label: "Clientes frecuentes",
            icon: "CF",
            permission: "customer.manage",
            description: "Base de clientes y puntos",
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
          {
            href: "/admin/categorias",
            label: "Categorías",
            icon: "CA",
            permission: "category.manage",
            description: "Secciones de la carta",
          },
        ],
      },
      {
        id: "costos",
        label: "Costos",
        items: [
          {
            href: "/admin/ingredientes",
            label: "Ingredientes",
            icon: "IN",
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
      {
        id: "comercial",
        label: "Comercial",
        items: [
          {
            href: "/admin/promociones",
            label: "Promociones",
            icon: "PM",
            permission: "promotion.manage",
            description: "Descuentos, combos y cupones",
          },
          {
            href: "/admin/eventos",
            label: "Eventos",
            icon: "EV",
            permission: "event.manage",
            description: "Agenda y publicaciones",
          },
          {
            href: "/admin/horarios",
            label: "Horarios",
            icon: "HO",
            permission: "hours.manage",
            description: "Turnos de atención",
          },
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
            description: "Moderación de opiniones",
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
          {
            href: "/admin/negocio",
            label: "Negocio",
            icon: "NE",
            permission: "business.manage",
            description: "Datos de contacto y ubicación",
          },
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
            label: "Carta",
            icon: "CT",
            permission: "brand.manage",
            description: "Vista pública de la carta",
          },
        ],
      },
      {
        id: "posicionamiento",
        label: "Posicionamiento",
        items: [
          {
            href: "/admin/seo",
            label: "SEO",
            icon: "SE",
            permission: "business.manage",
            description: "Títulos y descripciones por página",
          },
          {
            href: "/admin/redirecciones",
            label: "Redirecciones",
            icon: "RD",
            permission: "business.manage",
            description: "Enlaces antiguos a rutas vigentes",
          },
        ],
      },
      {
        id: "extension",
        label: "Extensión",
        items: [
          {
            href: "/admin/integraciones",
            label: "Integraciones",
            icon: "IG",
            permission: "business.manage",
            description: "Servicios y conexiones externas",
          },
          {
            href: "/admin/legales",
            label: "Páginas legales",
            icon: "LG",
            permission: "content.manage",
            description: "Políticas y condiciones",
          },
          {
            href: "/admin/casos",
            label: "Casos de éxito",
            icon: "CX",
            permission: "content.manage",
            description: "Historias de clientes",
          },
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
        id: "equipo",
        label: "Equipo",
        items: [
          {
            href: "/admin/usuarios",
            label: "Usuarios",
            icon: "US",
            permission: "user.manage",
            description: "Miembros, roles y permisos",
          },
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
        id: "datos",
        label: "Datos y archivos",
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
          {
            href: "/admin/ayuda",
            label: "Centro de ayuda",
            icon: "AY",
            permission: "content.manage",
            description: "Guías y preguntas frecuentes",
          },
          {
            href: "/admin/soporte",
            label: "Soporte",
            icon: "SO",
            permission: "support.manage",
            description: "Consultas y tickets de ayuda",
          },
        ],
      },
      {
        id: "cuenta",
        label: "Cuenta",
        items: [
          {
            href: "/admin/cuenta",
            label: "Mi cuenta",
            icon: "MC",
            permission: "admin.access",
            description: "Tu perfil y seguridad",
          },
        ],
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
