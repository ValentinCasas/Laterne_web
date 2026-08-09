export const adminResources = {
  productos: { model: "product", permission: "product.manage" },
  categorias: { model: "category", permission: "category.manage" },
  eventos: { model: "event", permission: "event.manage" },
  horarios: { model: "openingHour", permission: "hours.manage" },
  testimonios: { model: "testimonial", permission: "testimonial.moderate" },
  usuarios: { model: "user", permission: "user.manage" },
  negocio: { model: "businessInfo", permission: "business.manage" },
  promociones: { model: "promotion", permission: "promotion.manage" },
  legales: { model: "legalPage", permission: "content.manage" },
  ayuda: { model: "helpArticle", permission: "content.manage" },
  casos: { model: "successCase", permission: "content.manage" },
} as const;

export type AdminResource = keyof typeof adminResources;

/** @summary Recupera la configuración segura de un recurso administrativo conocido. */
export function getAdminResource(resource: string) {
  return adminResources[resource as AdminResource] ?? null;
}
