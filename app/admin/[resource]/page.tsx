import { notFound } from "next/navigation";
import { TestimonialBoard } from "@/components/admin/testimonial-board";
import { ResourceManager, type ResourceField, type ResourceOption } from "@/components/resource-manager";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { getAdminResource } from "@/lib/admin-resources";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ResourceDefinition = {
  title: string;
  description: string;
  model:
    | "product"
    | "category"
    | "event"
    | "openingHour"
    | "testimonial"
    | "user"
    | "businessInfo"
    | "promotion"
    | "legalPage"
    | "helpArticle"
    | "successCase"
    | "branch"
    | "seoPage"
    | "redirectRule";
  fields: ResourceField[];
  singular?: boolean;
};

/** @summary Combina archivos registrados y referencias históricas sin exponer imágenes de otros tenants. */
function tenantImageOptions(
  folder: string,
  assets: Array<{ folder: string; filename: string; url: string }>,
  historicalFilenames: Array<string | null | undefined>,
): ResourceOption[] {
  const options = new Map<string, ResourceOption>();
  for (const asset of assets.filter((item) => item.folder === folder)) {
    options.set(asset.filename, { value: asset.filename, label: asset.filename, image: asset.url });
  }
  for (const filename of historicalFilenames) {
    if (!filename || !/\.(?:avif|gif|jpe?g|png|webp)$/i.test(filename)) continue;
    options.set(filename, {
      value: filename,
      label: filename,
      image: `/images/${folder}/${filename}`,
    });
  }
  return [...options.values()].sort((first, second) => first.label.localeCompare(second.label, "es"));
}

/** @summary Construye la definición visual y los controles específicos de cada recurso. */
function createDefinition(
  resource: string,
  images: Record<string, ResourceOption[]>,
  categoryOptions: ResourceOption[],
  productOptions: ResourceOption[],
  roleOptions: ResourceOption[],
): ResourceDefinition | null {
  const definitions: Record<string, ResourceDefinition> = {
    productos: {
      title: "Productos",
      description:
        "Organizá la carta, sus precios, disponibilidad, categoría e imagen principal. La experiencia 3D y AR se configura en la sección avanzada del formulario.",
      model: "product",
      fields: [
        { key: "name", label: "Nombre", required: true, placeholder: "Ej. Hamburguesa Laterne" },
        {
          key: "slug",
          label: "Dirección pública",
          placeholder: "Se genera automáticamente si lo dejás vacío",
          help: "Ej. hamburguesa-laterne",
        },
        {
          key: "description",
          label: "Descripción",
          required: true,
          control: "textarea",
          placeholder: "Contá qué incluye y qué hace especial al producto.",
        },
        { key: "price", label: "Precio", type: "number", required: true, placeholder: "8500" },
        {
          key: "availability",
          label: "Disponibilidad",
          control: "select",
          options: [
            { value: "disponible", label: "Disponible" },
            { value: "agotado", label: "Agotado" },
          ],
        },
        {
          key: "availableDays",
          label: "Días disponibles",
          control: "multichoice",
          help: "Vacío significa todos los días",
          options: [
            { value: "1", label: "Lunes" },
            { value: "2", label: "Martes" },
            { value: "3", label: "Miércoles" },
            { value: "4", label: "Jueves" },
            { value: "5", label: "Viernes" },
            { value: "6", label: "Sábado" },
            { value: "0", label: "Domingo" },
          ],
        },
        { key: "availableStartTime", label: "Disponible desde", type: "time" },
        { key: "availableEndTime", label: "Disponible hasta", type: "time" },
        {
          key: "status",
          label: "Publicación",
          control: "select",
          required: true,
          options: [
            { value: "published", label: "Publicado" },
            { value: "scheduled", label: "Programado" },
            { value: "draft", label: "Borrador" },
            { value: "hidden", label: "Oculto" },
            { value: "archived", label: "Archivado" },
          ],
        },
        { key: "publishAt", label: "Publicar desde", type: "datetime-local" },
        { key: "featured", label: "Producto destacado", control: "checkbox" },
        { key: "isNew", label: "Marcar como nuevo", control: "checkbox" },
        { key: "recommended", label: "Recomendación del bar", control: "checkbox" },
        { key: "vegetarian", label: "Vegetariano", control: "checkbox" },
        { key: "vegan", label: "Vegano", control: "checkbox" },
        { key: "glutenFree", label: "Sin gluten", control: "checkbox" },
        { key: "alcoholFree", label: "Sin alcohol", control: "checkbox" },
        {
          key: "spiceLevel",
          label: "Nivel de picante",
          control: "select",
          options: [
            { value: "0", label: "Sin picante" },
            { value: "1", label: "Suave" },
            { value: "2", label: "Medio" },
            { value: "3", label: "Intenso" },
          ],
        },
        { key: "preparationMinutes", label: "Preparación estimada", type: "number", help: "Minutos" },
        { key: "promotionalPrice", label: "Precio promocional", type: "number" },
        { key: "previousPrice", label: "Precio anterior", type: "number" },
        {
          key: "categoryId",
          label: "Categoría de la carta",
          control: "choice",
          required: true,
          options: categoryOptions,
        },
        {
          key: "imageUrl",
          label: "Imagen del producto",
          control: "image",
          required: true,
          options: images.productos,
          imageFolder: "images_product",
          fallbackImage: "/images/image_defect/product_default.png",
        },
        {
          key: "model3dUrl",
          label: "Modelo principal GLB o GLTF",
          control: "asset",
          accept: ".glb,.gltf,model/gltf-binary,model/gltf+json",
          help: "GLB hasta 40 MB o GLTF autónomo hasta 15 MB.",
          previewModel: true,
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "usdzUrl",
          label: "Modelo USDZ para iPhone",
          control: "asset",
          accept: ".usdz,model/vnd.usdz+zip,application/octet-stream",
          help: "Opcional. Quick Look puede utilizar este archivo de hasta 60 MB.",
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "arEnabled",
          label: "Habilitar experiencia 3D y AR",
          control: "checkbox",
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "arScale",
          label: "Escala inicial del modelo",
          type: "number",
          min: 0.01,
          max: 20,
          step: 0.01,
          help: "1 representa el tamaño original",
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "modelWidthCm",
          label: "Ancho real",
          type: "number",
          min: 0.1,
          max: 1000,
          step: 0.1,
          help: "Centímetros",
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "modelHeightCm",
          label: "Alto real",
          type: "number",
          min: 0.1,
          max: 1000,
          step: 0.1,
          help: "Centímetros",
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "modelDepthCm",
          label: "Profundidad real",
          type: "number",
          min: 0.1,
          max: 1000,
          step: 0.1,
          help: "Centímetros",
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "modelOrientation",
          label: "Rotación inicial",
          placeholder: "0deg 0deg 0deg",
          help: "Giro, inclinación y orientación",
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "arPlacement",
          label: "Superficie de colocación",
          control: "select",
          required: true,
          options: [
            { value: "floor", label: "Horizontal, como una mesa" },
            { value: "wall", label: "Vertical, como una pared" },
          ],
          group: "Experiencia 3D y realidad aumentada",
        },
        {
          key: "arAllowScale",
          label: "Permitir ajustar tamaño en AR",
          control: "checkbox",
          group: "Experiencia 3D y realidad aumentada",
        },
      ],
    },
    categorias: {
      title: "Categorías",
      description: "Creá secciones visuales para que la carta sea rápida de recorrer y entender.",
      model: "category",
      fields: [
        { key: "name", label: "Nombre", required: true, placeholder: "Ej. Cervezas artesanales" },
        {
          key: "slug",
          label: "Dirección pública",
          placeholder: "Se genera automáticamente",
        },
        {
          key: "description",
          label: "Descripción",
          required: true,
          control: "textarea",
          placeholder: "Una descripción breve de esta sección de la carta.",
        },
        {
          key: "status",
          label: "Publicación",
          control: "select",
          required: true,
          options: [
            { value: "published", label: "Publicada" },
            { value: "scheduled", label: "Programada" },
            { value: "draft", label: "Borrador" },
            { value: "hidden", label: "Oculta" },
            { value: "archived", label: "Archivada" },
          ],
        },
        { key: "publishAt", label: "Publicar desde", type: "datetime-local" },
        { key: "sortOrder", label: "Orden", type: "number", help: "Menor aparece primero" },
        {
          key: "imageUrl",
          label: "Ícono o imagen de categoría",
          control: "image",
          required: true,
          options: images.categorias,
          imageFolder: "images_categories",
          fallbackImage: "/images/images_categories/bottle-1-svgrepo-com.png",
        },
      ],
    },
    eventos: {
      title: "Eventos",
      description: "Publicá fechas, encuentros y espectáculos que aparecerán en el inicio.",
      model: "event",
      fields: [
        {
          key: "name",
          label: "Nombre del evento",
          required: true,
          placeholder: "Ej. Noche de música en vivo",
        },
        {
          key: "description",
          label: "Descripción",
          required: true,
          control: "textarea",
          placeholder: "Explicá brevemente de qué se trata.",
        },
        { key: "location", label: "Ubicación", required: true, placeholder: "Laterne · La Punta" },
        { key: "date", label: "Fecha", type: "date" },
        { key: "time", label: "Hora", type: "time" },
        {
          key: "status",
          label: "Publicación",
          control: "select",
          required: true,
          options: [
            { value: "published", label: "Publicado" },
            { value: "scheduled", label: "Programado" },
            { value: "draft", label: "Borrador" },
            { value: "hidden", label: "Oculto" },
            { value: "archived", label: "Archivado" },
          ],
        },
        { key: "publishAt", label: "Publicar desde", type: "datetime-local" },
        {
          key: "imageUrl",
          label: "Flyer o imagen del evento",
          control: "image",
          options: images.eventos,
          imageFolder: "images_event",
        },
      ],
    },
    horarios: {
      title: "Horarios",
      description: "Definí los turnos de atención que se muestran agrupados en la página principal.",
      model: "openingHour",
      fields: [
        { key: "dayOfWeek", label: "Días", required: true, placeholder: "Ej. Lunes, Martes y Miércoles" },
        { key: "morningStartTime", label: "Apertura del primer turno", type: "time" },
        { key: "morningEndTime", label: "Cierre del primer turno", type: "time" },
        { key: "eveningStartTime", label: "Apertura del segundo turno", type: "time" },
        { key: "eveningEndTime", label: "Cierre del segundo turno", type: "time" },
      ],
    },
    testimonios: {
      title: "Testimonios",
      description: "Moderá las opiniones anónimas antes de publicarlas en el sitio.",
      model: "testimonial",
      fields: [
        { key: "description", label: "Comentario", required: true, control: "textarea" },
        {
          key: "moderationStatus",
          label: "Estado",
          required: true,
          control: "select",
          options: [
            { value: "false", label: "Pendiente" },
            { value: "true", label: "Aprobado y visible" },
          ],
        },
      ],
    },
    usuarios: {
      title: "Usuarios",
      description: "Administrá las personas que pueden ingresar al panel y sus permisos.",
      model: "user",
      fields: [
        { key: "name", label: "Nombre", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        {
          key: "roleId",
          label: "Rol dentro del negocio",
          required: true,
          control: "select",
          options: roleOptions,
        },
        { key: "password", label: "Contraseña", type: "password", help: "Dejala vacía para conservarla" },
        {
          key: "imageUrl",
          label: "Avatar",
          control: "image",
          options: images.usuarios,
          imageFolder: "images_profile",
          fallbackImage: "/images/images_profile/avatar_profile_default.png",
        },
      ],
    },
    negocio: {
      title: "Información del negocio",
      description: "Mantené actualizados los datos de contacto, ubicación y redes sociales.",
      model: "businessInfo",
      singular: true,
      fields: [
        { key: "address", label: "Dirección", placeholder: "Dirección completa" },
        { key: "email", label: "Email", type: "email" },
        { key: "phoneNumber", label: "Teléfono", type: "tel" },
        { key: "location", label: "Ubicación", control: "location" },
        { key: "instagramUrl", label: "Instagram", type: "url", placeholder: "https://instagram.com/..." },
        { key: "facebookUrl", label: "Facebook", type: "url", placeholder: "https://facebook.com/..." },
      ],
    },
    promociones: {
      title: "Promociones",
      description: "Programá descuentos, combos, happy hours y cupones relacionados con la carta.",
      model: "promotion",
      fields: [
        { key: "name", label: "Nombre", required: true, placeholder: "Ej. Happy hour Laterne" },
        {
          key: "slug",
          label: "Dirección pública",
          placeholder: "Se genera automáticamente",
        },
        {
          key: "description",
          label: "Descripción",
          control: "textarea",
          required: true,
          placeholder: "Explicá el beneficio de forma clara.",
        },
        {
          key: "type",
          label: "Tipo de promoción",
          control: "select",
          required: true,
          options: [
            { value: "percentage", label: "Descuento porcentual" },
            { value: "fixed_amount", label: "Descuento fijo en $" },
            { value: "special_price", label: "Precio especial" },
            { value: "two_for_one", label: "Dos por uno" },
            { value: "happy_hour", label: "Happy hour" },
            { value: "combo", label: "Combo (Próximamente)", disabled: true },
            { value: "day", label: "Promoción por día" },
            { value: "time", label: "Promoción por horario" },
            { value: "coupon", label: "Cupón" },
            { value: "birthday", label: "Beneficio de cumpleaños (Próximamente)", disabled: true },
          ],
        },
        {
          key: "discountValue",
          label: "Valor del beneficio",
          type: "number",
          min: 0,
          step: 0.01,
          help: "Porcentaje o importe según el tipo",
        },
        {
          key: "minimumPurchase",
          label: "Compra mínima",
          type: "number",
          min: 0,
          step: 0.01,
          help: "Importe mínimo del pedido para aplicar el descuento (opcional)",
        },
        { key: "buyQuantity", label: "Cantidad que compra", type: "number", min: 1 },
        { key: "receiveQuantity", label: "Cantidad que recibe", type: "number", min: 1 },
        { key: "startAt", label: "Comienza", type: "datetime-local" },
        { key: "endAt", label: "Finaliza", type: "datetime-local" },
        { key: "publishAt", label: "Publicar desde", type: "datetime-local" },
        { key: "startTime", label: "Horario desde", type: "time" },
        { key: "endTime", label: "Horario hasta", type: "time" },
        {
          key: "daysOfWeek",
          label: "Días aplicables",
          placeholder: "lunes, martes, miércoles",
          help: "Separados por comas",
        },
        { key: "code", label: "Código promocional", placeholder: "Ej. LATERNE20" },
        { key: "conditions", label: "Condiciones", control: "textarea" },
        {
          key: "status",
          label: "Publicación",
          control: "select",
          required: true,
          options: [
            { value: "published", label: "Publicada" },
            { value: "draft", label: "Borrador" },
            { value: "scheduled", label: "Programada" },
            { value: "hidden", label: "Oculta" },
            { value: "archived", label: "Archivada" },
          ],
        },
        { key: "priority", label: "Prioridad", type: "number", min: 0 },
        {
          key: "productIds",
          label: "Productos alcanzados",
          control: "multichoice",
          options: productOptions,
        },
        {
          key: "categoryIds",
          label: "Categorías alcanzadas",
          control: "multichoice",
          options: categoryOptions,
        },
        {
          key: "imageUrl",
          label: "Imagen de la promoción",
          control: "image",
          options: images.promociones,
          imageFolder: "images_promotions",
        },
      ],
    },
    legales: {
      title: "Páginas legales",
      description: "Administrá políticas, condiciones, cookies, alérgenos y derechos de privacidad.",
      model: "legalPage",
      fields: [
        { key: "title", label: "Título", required: true },
        { key: "slug", label: "Dirección pública", placeholder: "politica-de-privacidad" },
        { key: "content", label: "Contenido", control: "textarea", required: true },
        {
          key: "status",
          label: "Publicación",
          control: "select",
          required: true,
          options: [
            { value: "published", label: "Publicada" },
            { value: "draft", label: "Borrador" },
            { value: "hidden", label: "Oculta" },
          ],
        },
      ],
    },
    ayuda: {
      title: "Artículos de ayuda",
      description: "Creá respuestas, guías y tutoriales buscables para clientes y administradores.",
      model: "helpArticle",
      fields: [
        { key: "title", label: "Título", required: true },
        { key: "slug", label: "Dirección pública", placeholder: "como-hacer-un-pedido" },
        { key: "summary", label: "Resumen", control: "textarea", required: true },
        { key: "content", label: "Contenido de la guía", control: "textarea", required: true },
        { key: "category", label: "Categoría", required: true, placeholder: "Pedidos" },
        {
          key: "audience",
          label: "Audiencia",
          control: "select",
          options: [
            { value: "public", label: "Clientes" },
            { value: "admin", label: "Administradores" },
            { value: "all", label: "Todos" },
          ],
        },
        {
          key: "status",
          label: "Publicación",
          control: "select",
          options: [
            { value: "published", label: "Publicado" },
            { value: "draft", label: "Borrador" },
            { value: "hidden", label: "Oculto" },
          ],
        },
        { key: "displayOrder", label: "Orden", type: "number" },
      ],
    },
    casos: {
      title: "Casos de éxito",
      description: "Documentá implementaciones reales, funciones utilizadas y resultados obtenidos.",
      model: "successCase",
      fields: [
        { key: "businessName", label: "Nombre del negocio", required: true },
        { key: "slug", label: "Dirección pública", placeholder: "nombre-del-negocio" },
        { key: "businessType", label: "Tipo de negocio", required: true },
        { key: "location", label: "Ubicación", required: true },
        { key: "initialProblem", label: "Problema inicial", control: "textarea", required: true },
        { key: "solution", label: "Solución implementada", control: "textarea", required: true },
        { key: "features", label: "Funciones utilizadas", control: "textarea", required: true },
        { key: "results", label: "Resultados obtenidos", control: "textarea", required: true },
        { key: "testimonial", label: "Testimonio", control: "textarea" },
        { key: "websiteUrl", label: "Sitio web", type: "url" },
        { key: "planName", label: "Plan contratado" },
        {
          key: "status",
          label: "Publicación",
          control: "select",
          options: [
            { value: "published", label: "Publicado" },
            { value: "draft", label: "Borrador" },
            { value: "hidden", label: "Oculto" },
          ],
        },
        { key: "sortOrder", label: "Orden", type: "number" },
        {
          key: "logoUrl",
          label: "Logo",
          control: "image",
          options: images.casos,
          imageFolder: "images_cases",
        },
        {
          key: "coverUrl",
          label: "Portada",
          control: "image",
          options: images.casos,
          imageFolder: "images_cases",
        },
      ],
    },
    sucursales: {
      title: "Sucursales",
      description: "Administrá ubicaciones, costos de entrega, contacto y origen operativo de los pedidos.",
      model: "branch",
      fields: [
        { key: "name", label: "Nombre", required: true, placeholder: "Ej. Laterne Centro" },
        { key: "slug", label: "Identificador", placeholder: "laterne-centro" },
        { key: "address", label: "Dirección", required: true },
        { key: "city", label: "Ciudad" },
        { key: "province", label: "Provincia" },
        { key: "phone", label: "Teléfono", type: "tel" },
        { key: "whatsapp", label: "WhatsApp", type: "tel" },
        { key: "location", label: "Ubicación en el mapa", control: "location" },
        { key: "deliveryFee", label: "Costo de entrega", type: "number", min: 0, step: 0.01 },
        { key: "minimumOrder", label: "Pedido mínimo", type: "number", min: 0, step: 0.01 },
        { key: "orderPrefix", label: "Prefijo de pedido", placeholder: "PED" },
        { key: "isPrimary", label: "Sucursal principal", control: "checkbox" },
        {
          key: "active",
          label: "Sucursal activa",
          control: "checkbox",
          defaultChecked: true,
        },
      ],
    },
    seo: {
      title: "SEO por página",
      description:
        "Controlá títulos, descripciones, imagen social, canonical e indexación sin editar código.",
      model: "seoPage",
      fields: [
        { key: "path", label: "Ruta", required: true, placeholder: "/carta" },
        { key: "title", label: "Título SEO", required: true },
        { key: "description", label: "Descripción", control: "textarea", required: true },
        { key: "canonical", label: "URL canonical", type: "url" },
        { key: "ogImageUrl", label: "Imagen para compartir", type: "url" },
        { key: "noIndex", label: "No permitir indexación", control: "checkbox" },
      ],
    },
    redirecciones: {
      title: "Redirecciones",
      description: "Conservá enlaces anteriores enviándolos de forma segura hacia una ruta pública vigente.",
      model: "redirectRule",
      fields: [
        { key: "sourcePath", label: "Ruta anterior", required: true, placeholder: "/menu-viejo" },
        { key: "targetPath", label: "Ruta de destino", required: true, placeholder: "/carta" },
        { key: "permanent", label: "Redirección permanente", control: "checkbox" },
        {
          key: "active",
          label: "Regla activa",
          control: "checkbox",
          defaultChecked: true,
        },
      ],
    },
  };

  return definitions[resource] ?? null;
}

/** @summary Obtiene los registros y adapta las relaciones necesarias para su edición. */
async function loadItems(definition: ResourceDefinition, tenantId: number) {
  if (definition.model === "product") {
    const products = await prisma.product.findMany({
      where: { tenantId },
      include: { categories: { select: { categoryId: true }, take: 1 } },
      orderBy: { id: "asc" },
    });
    return products.map(({ categories, ...product }) => ({
      ...product,
      categoryId: categories[0]?.categoryId?.toString() ?? "",
    }));
  }

  if (definition.model === "user") {
    const memberships = await prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: true,
        role: true,
        sessions: {
          select: { lastSeenAt: true },
          orderBy: { lastSeenAt: "desc" },
          take: 1,
        },
      },
      orderBy: { user: { name: "asc" } },
    });
    return memberships.map(({ user, role, sessions, id: membershipId, roleId }) => ({
      ...user,
      membershipId,
      roleId: roleId.toString(),
      roleName: role.name,
      lastAccessAt: sessions[0]?.lastSeenAt ?? null,
      password: "",
    }));
  }

  if (definition.model === "promotion") {
    const promotions = await prisma.promotion.findMany({
      where: { tenantId },
      include: {
        products: { select: { productId: true } },
        categories: { select: { categoryId: true } },
      },
      orderBy: [{ priority: "desc" }, { id: "desc" }],
    });
    return promotions.map(({ products, categories, daysOfWeek, ...promotion }) => ({
      ...promotion,
      daysOfWeek: Array.isArray(daysOfWeek) ? daysOfWeek.join(", ") : "",
      productIds: products.map((item) => item.productId).join(","),
      categoryIds: categories.map((item) => item.categoryId).join(","),
    }));
  }

  const delegate = prisma[definition.model as keyof typeof prisma] as unknown as {
    findMany(args: object): Promise<unknown[]>;
  };
  return delegate.findMany({ where: { tenantId }, orderBy: { id: "asc" } });
}

/** @summary Carga la configuración, imágenes y registros del recurso administrativo solicitado. */
export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const resourceConfig = getAdminResource(resource);
  if (!resourceConfig) notFound();
  const context = await requirePermission(resourceConfig.permission);
  const tenantId = context.tenant.id;
  const [categories, products, roles, tenant, mediaAssets, events, memberships, promotions, cases] =
    await Promise.all([
      prisma.category.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.product.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.role.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
      prisma.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { defaultCurrency: true, locale: true },
      }),
      prisma.mediaAsset.findMany({
        where: { tenantId },
        select: { folder: true, filename: true, url: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.event.findMany({ where: { tenantId }, select: { imageUrl: true } }),
      prisma.tenantMembership.findMany({
        where: { tenantId },
        select: { user: { select: { imageUrl: true } } },
      }),
      prisma.promotion.findMany({ where: { tenantId }, select: { imageUrl: true } }),
      prisma.successCase.findMany({
        where: { tenantId },
        select: { logoUrl: true, coverUrl: true },
      }),
    ]);

  const productImages = tenantImageOptions(
    "images_product",
    mediaAssets,
    products.map((product) => product.imageUrl),
  );
  const categoryImages = tenantImageOptions(
    "images_categories",
    mediaAssets,
    categories.map((category) => category.imageUrl),
  );
  const eventImages = tenantImageOptions(
    "images_event",
    mediaAssets,
    events.map((event) => event.imageUrl),
  );
  const userImages = tenantImageOptions(
    "images_profile",
    mediaAssets,
    memberships.map((membership) => membership.user.imageUrl),
  );
  const promotionImages = tenantImageOptions(
    "images_promotions",
    mediaAssets,
    promotions.map((promotion) => promotion.imageUrl),
  );
  const caseImages = tenantImageOptions(
    "images_cases",
    mediaAssets,
    cases.flatMap((item) => [item.logoUrl, item.coverUrl]),
  );

  const categoryOptions = categories.map((category) => ({
    value: category.id.toString(),
    label: category.name,
    image: `/images/images_categories/${category.imageUrl}`,
  }));
  const definition = createDefinition(
    resource,
    {
      productos: productImages,
      categorias: categoryImages,
      eventos: eventImages,
      usuarios: userImages,
      promociones: promotionImages,
      casos: caseImages,
    },
    categoryOptions,
    products.map((product) => ({ value: product.id.toString(), label: product.name })),
    roles.map((role) => ({ value: role.id.toString(), label: role.name })),
  );
  if (!definition) notFound();

  const items = await loadItems(definition, tenantId);
  if (resource === "testimonios") {
    return (
      <TestimonialBoard
        initialItems={
          serialize(items) as Array<{
            id: number;
            description: string;
            date: string;
            state: boolean;
            moderationStatus: string;
          }>
        }
      />
    );
  }

  return (
    <ResourceManager
      title={definition.title}
      description={definition.description}
      resource={resource}
      initialItems={serialize(items) as Array<Record<string, unknown> & { id: number }>}
      fields={definition.fields}
      singular={definition.singular}
      currency={tenant.defaultCurrency}
      locale={tenant.locale}
    />
  );
}
