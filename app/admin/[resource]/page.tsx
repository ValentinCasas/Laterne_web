import { readdir } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { TestimonialBoard } from "@/components/admin/testimonial-board";
import { ResourceManager, type ResourceField, type ResourceOption } from "@/components/resource-manager";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export const dynamic = "force-dynamic";

type ResourceDefinition = {
  title: string;
  description: string;
  model: "product" | "category" | "event" | "openingHour" | "testimonial" | "user" | "businessInfo";
  fields: ResourceField[];
  singular?: boolean;
};

/** @summary Lee imágenes válidas de una carpeta pública para construir una galería seleccionable. */
async function readImageOptions(folder: string): Promise<ResourceOption[]> {
  try {
    const files = await readdir(path.join(process.cwd(), "public", "images", folder));
    return files
      .filter((file) => /\.(?:avif|gif|jpe?g|png|webp)$/i.test(file))
      .sort((first, second) => first.localeCompare(second, "es"))
      .map((file) => ({ value: file, label: file, image: `/images/${folder}/${file}` }));
  } catch {
    return [];
  }
}

/** @summary Construye la definición visual y los controles específicos de cada recurso. */
function createDefinition(
  resource: string,
  images: Record<string, ResourceOption[]>,
  categoryOptions: ResourceOption[],
): ResourceDefinition | null {
  const definitions: Record<string, ResourceDefinition> = {
    productos: {
      title: "Productos",
      description: "Organizá la carta, sus precios, disponibilidad, categoría e imagen principal.",
      model: "product",
      fields: [
        { key: "name", label: "Nombre", required: true, placeholder: "Ej. Hamburguesa Laterne" },
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
      ],
    },
    categorias: {
      title: "Categorías",
      description: "Creá secciones visuales para que la carta sea rápida de recorrer y entender.",
      model: "category",
      fields: [
        { key: "name", label: "Nombre", required: true, placeholder: "Ej. Cervezas artesanales" },
        {
          key: "description",
          label: "Descripción",
          required: true,
          control: "textarea",
          placeholder: "Una descripción breve de esta sección de la carta.",
        },
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
          key: "role",
          label: "Permisos",
          required: true,
          control: "select",
          options: [
            { value: "1", label: "Administrador" },
            { value: "0", label: "Editor" },
          ],
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
  };

  return definitions[resource] ?? null;
}

/** @summary Obtiene los registros y adapta las relaciones necesarias para su edición. */
async function loadItems(definition: ResourceDefinition) {
  if (definition.model === "product") {
    const products = await prisma.product.findMany({
      include: { categories: { select: { categoryId: true }, take: 1 } },
      orderBy: { id: "asc" },
    });
    return products.map(({ categories, ...product }) => ({
      ...product,
      categoryId: categories[0]?.categoryId?.toString() ?? "",
    }));
  }

  const delegate = prisma[definition.model as keyof typeof prisma] as unknown as {
    findMany(args: object): Promise<unknown[]>;
  };
  return delegate.findMany({ orderBy: { id: "asc" } });
}

/** @summary Carga la configuración, imágenes y registros del recurso administrativo solicitado. */
export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const [productImages, categoryImages, eventImages, userImages, categories] = await Promise.all([
    readImageOptions("images_product"),
    readImageOptions("images_categories"),
    readImageOptions("images_event"),
    readImageOptions("images_profile"),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

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
    },
    categoryOptions,
  );
  if (!definition) notFound();

  const items = await loadItems(definition);
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
    />
  );
}
