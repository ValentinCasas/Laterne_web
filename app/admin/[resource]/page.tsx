import { notFound } from "next/navigation";
import { ResourceManager } from "@/components/resource-manager";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export const dynamic = "force-dynamic";

const definitions = {
  productos: {
    title: "Productos",
    model: "product",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "description", label: "Descripción", required: true },
      { key: "price", label: "Precio", type: "number" },
      { key: "availability", label: "Disponibilidad" },
      { key: "imageUrl", label: "Archivo de imagen", required: true },
    ],
  },
  categorias: {
    title: "Categorías",
    model: "category",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "description", label: "Descripción", required: true },
      { key: "imageUrl", label: "Archivo de imagen", required: true },
    ],
  },
  eventos: {
    title: "Eventos",
    model: "event",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "description", label: "Descripción", required: true },
      { key: "location", label: "Ubicación", required: true },
      { key: "date", label: "Fecha", type: "date" },
      { key: "time", label: "Hora", type: "time" },
      { key: "imageUrl", label: "Archivo de imagen" },
    ],
  },
  horarios: {
    title: "Horarios",
    model: "openingHour",
    fields: [
      { key: "dayOfWeek", label: "Día", required: true },
      { key: "morningStartTime", label: "Apertura mañana", type: "time" },
      { key: "morningEndTime", label: "Cierre mañana", type: "time" },
      { key: "eveningStartTime", label: "Apertura tarde", type: "time" },
      { key: "eveningEndTime", label: "Cierre tarde", type: "time" },
    ],
  },
  testimonios: {
    title: "Testimonios",
    model: "testimonial",
    fields: [
      { key: "description", label: "Comentario", required: true },
      { key: "state", label: "Aprobado (true/false)", required: true },
    ],
  },
  usuarios: {
    title: "Usuarios",
    model: "user",
    fields: [
      { key: "name", label: "Nombre", required: true },
      { key: "email", label: "Email", type: "email", required: true },
      { key: "role", label: "Rol (1 admin)", type: "number", required: true },
      { key: "password", label: "Contraseña", type: "password" },
      { key: "imageUrl", label: "Archivo de avatar" },
    ],
  },
  negocio: {
    title: "Información del negocio",
    model: "businessInfo",
    fields: [
      { key: "address", label: "Dirección" },
      { key: "email", label: "Email", type: "email" },
      { key: "phoneNumber", label: "Teléfono" },
      { key: "latitude", label: "Latitud" },
      { key: "longitude", label: "Longitud" },
      { key: "instagramUrl", label: "Instagram" },
      { key: "facebookUrl", label: "Facebook" },
    ],
  },
} as const;

/** @summary Carga la configuración y los registros del recurso administrativo solicitado. */
export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const definition = definitions[resource as keyof typeof definitions];
  if (!definition) notFound();
  const delegate = prisma[definition.model as keyof typeof prisma] as unknown as {
    findMany(args: object): Promise<unknown[]>;
  };
  const items = await delegate.findMany({ orderBy: { id: "asc" } });
  return (
    <ResourceManager
      title={definition.title}
      resource={resource}
      initialItems={serialize(items) as Array<Record<string, unknown> & { id: number }>}
      fields={[...definition.fields]}
    />
  );
}
