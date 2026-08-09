import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminResource } from "@/lib/admin-resources";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { localModelUrl, modelOrientation, optionalMeasurement } from "@/lib/product-model";
import { promotionData } from "@/lib/promotion-admin";
import { slugify, uniqueCategorySlug, uniqueProductSlug } from "@/lib/slug";

const inputSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
type Delegate = { create(args: { data: Record<string, unknown> }): Promise<unknown> };

/** @summary Copia únicamente los campos permitidos para evitar asignaciones administrativas inesperadas. */
function selectFields(input: Record<string, string>, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, input[field] ?? ""]));
}

/** @summary Convierte una entrada de formulario en un valor booleano explícito. */
function booleanValue(value: string) {
  return value === "true" || value === "1" || value === "on";
}

/** @summary Normaliza y valida los campos de un recurso antes de guardarlo por primera vez. */
async function normalize(resource: string, input: Record<string, string>, tenantId: number) {
  if (resource === "productos") {
    const categoryId = Number(input.categoryId);
    const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
    if (!category) throw new Error("Seleccioná una categoría válida");
    const fields = selectFields(input, ["name", "description", "availability", "imageUrl", "status"]);
    if (!fields.name.trim() || !fields.description.trim())
      throw new Error("Completá el nombre y la descripción");
    const model3dUrl = localModelUrl(input.model3dUrl ?? "", tenantId, ["glb", "gltf"]);
    const usdzUrl = localModelUrl(input.usdzUrl ?? "", tenantId, ["usdz"]);
    return {
      ...fields,
      tenantId,
      status: fields.status || "published",
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      slug: await uniqueProductSlug(tenantId, input.slug || fields.name),
      price: input.price ? Number(input.price) : null,
      promotionalPrice: input.promotionalPrice ? Number(input.promotionalPrice) : null,
      previousPrice: input.previousPrice ? Number(input.previousPrice) : null,
      preparationMinutes: input.preparationMinutes ? Number(input.preparationMinutes) : null,
      spiceLevel: Math.min(3, Math.max(0, Number(input.spiceLevel || 0))),
      featured: booleanValue(input.featured),
      isNew: booleanValue(input.isNew),
      recommended: booleanValue(input.recommended),
      vegetarian: booleanValue(input.vegetarian),
      vegan: booleanValue(input.vegan),
      glutenFree: booleanValue(input.glutenFree),
      alcoholFree: booleanValue(input.alcoholFree),
      model3dUrl,
      usdzUrl,
      arEnabled: Boolean(model3dUrl) && booleanValue(input.arEnabled),
      arScale: optionalMeasurement(input.arScale || "1", 0.01, 20),
      modelWidthCm: optionalMeasurement(input.modelWidthCm ?? ""),
      modelHeightCm: optionalMeasurement(input.modelHeightCm ?? ""),
      modelDepthCm: optionalMeasurement(input.modelDepthCm ?? ""),
      modelOrientation: modelOrientation(input.modelOrientation ?? ""),
      arPlacement: input.arPlacement === "wall" ? "wall" : "floor",
      arAllowScale: booleanValue(input.arAllowScale),
      modelUpdatedAt: model3dUrl ? new Date() : null,
      categories: { create: { tenantId, categoryId } },
    };
  }

  if (resource === "categorias") {
    const fields = selectFields(input, ["name", "description", "imageUrl", "status"]);
    if (!fields.name.trim() || !fields.description.trim())
      throw new Error("Completá el nombre y la descripción");
    return {
      ...fields,
      tenantId,
      status: fields.status || "published",
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      slug: await uniqueCategorySlug(tenantId, input.slug || fields.name),
      sortOrder: Number(input.sortOrder || 0),
    };
  }

  if (resource === "eventos") {
    return {
      ...selectFields(input, ["name", "description", "location", "imageUrl", "status"]),
      tenantId,
      status: input.status || "published",
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      time: input.time ? new Date(`1970-01-01T${input.time}:00Z`) : null,
    };
  }

  if (resource === "horarios") {
    const data: Record<string, unknown> = { tenantId, dayOfWeek: input.dayOfWeek };
    for (const key of ["morningStartTime", "morningEndTime", "eveningStartTime", "eveningEndTime"]) {
      data[key] = input[key] ? new Date(`1970-01-01T${input[key]}:00Z`) : null;
    }
    return data;
  }

  if (resource === "testimonios") {
    const status = input.moderationStatus || "pending";
    return {
      tenantId,
      description: input.description,
      moderationStatus: status,
      state: status === "approved",
      date: new Date(),
    };
  }

  if (resource === "negocio") {
    return {
      ...selectFields(input, ["address", "email", "latitude", "longitude", "instagramUrl", "facebookUrl"]),
      tenantId,
      phoneNumber: input.phoneNumber ? BigInt(input.phoneNumber.replace(/\D/g, "")) : null,
    };
  }

  if (resource === "promociones") {
    return promotionData(input, tenantId);
  }

  if (resource === "legales") {
    if (!input.title?.trim() || !input.content?.trim()) throw new Error("Completá el título y el contenido");
    return {
      tenantId,
      title: input.title.trim(),
      slug: slugify(input.slug || input.title) || "pagina-legal",
      content: input.content.trim(),
      status: input.status || "published",
    };
  }

  if (resource === "ayuda") {
    if (!input.title?.trim() || !input.summary?.trim() || !input.content?.trim()) {
      throw new Error("Completá título, resumen y contenido");
    }
    return {
      tenantId,
      title: input.title.trim(),
      slug: slugify(input.slug || input.title) || "articulo",
      summary: input.summary.trim(),
      content: input.content.trim(),
      category: input.category?.trim() || "General",
      audience: ["public", "admin", "all"].includes(input.audience) ? input.audience : "public",
      status: input.status || "published",
      displayOrder: Number(input.displayOrder || 0),
    };
  }

  if (resource === "casos") {
    const required = [
      "businessName",
      "businessType",
      "location",
      "initialProblem",
      "solution",
      "features",
      "results",
    ];
    if (required.some((field) => !input[field]?.trim()))
      throw new Error("Completá la información principal del caso");
    return {
      tenantId,
      ...selectFields(input, [
        "businessName",
        "logoUrl",
        "coverUrl",
        "businessType",
        "location",
        "initialProblem",
        "solution",
        "features",
        "results",
        "testimonial",
        "websiteUrl",
        "planName",
        "status",
      ]),
      slug: slugify(input.slug || input.businessName) || "caso",
      status: input.status || "published",
      sortOrder: Number(input.sortOrder || 0),
    };
  }

  throw new Error("El recurso necesita un flujo de creación específico");
}

/** @summary Crea un usuario y su membresía dentro del negocio sin compartir permisos accidentalmente. */
async function createMember(input: Record<string, string>, tenantId: number) {
  const email = z.string().trim().email().parse(input.email).toLocaleLowerCase("es");
  const password = z.string().min(8).parse(input.password);
  const roleId = Number(input.roleId);
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new Error("Seleccioná un rol válido");

  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name: input.name.trim(),
        email,
        password: await bcrypt.hash(password, 12),
        role: ["owner", "administrator"].includes(role.key) ? 1 : 0,
        imageUrl: input.imageUrl || "avatar_profile_default.png",
      },
    });
    await transaction.tenantMembership.create({ data: { tenantId, userId: user.id, roleId } });
    return { ...user, roleId: roleId.toString(), roleName: role.name, password: "" };
  });
}

/** @summary Crea un recurso después de validar tenant, permiso, contenido y relaciones. */
export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const resourceConfig = getAdminResource(resource);
  if (!resourceConfig) return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  const auth = await authorize(resourceConfig.permission);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const input = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, value === null ? "" : String(value)]),
  );

  try {
    const item =
      resource === "usuarios"
        ? await createMember(input, auth.tenant.id)
        : await (prisma[resourceConfig.model] as unknown as Delegate).create({
            data: await normalize(resource, input, auth.tenant.id),
          });
    await recordAudit({
      context: auth,
      action: "create",
      entityType: resource,
      entityId: (item as { id?: number }).id,
      newValues: toAuditValue(serialize(item)),
      request,
    });
    return NextResponse.json({ item: serialize(item) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el registro" },
      { status: 400 },
    );
  }
}
