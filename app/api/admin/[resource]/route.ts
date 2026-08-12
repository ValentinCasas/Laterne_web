import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminResource } from "@/lib/admin-resources";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { assertBranchCapacity, ensureBranchProduct, ensureBranchStock, ensureDraftLicense, resolveEffectiveBranchId } from "@/lib/branch";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { productAdminData } from "@/lib/product-admin";
import { promotionData } from "@/lib/promotion-admin";
import { slugify, uniqueCategorySlug } from "@/lib/slug";
import { ensureTenantCapacity } from "@/lib/tenant-limits";

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
async function normalize(resource: string, input: Record<string, string>, tenantId: number, branchId?: number) {
  if (resource === "productos") {
    const { data } = await productAdminData(input, tenantId, branchId);
    return data;
  }

  if (resource === "categorias") {
    const fields = selectFields(input, ["name", "description", "imageUrl", "status"]);
    if (!fields.name.trim() || !fields.description.trim())
      throw new Error("Completá el nombre y la descripción");
    return {
      ...fields,
      tenantId,
      branchId: branchId ?? null,
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
      branchId: branchId ?? null,
      status: input.status || "published",
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      time: input.time ? new Date(`1970-01-01T${input.time}:00Z`) : null,
    };
  }

  if (resource === "horarios") {
    const data: Record<string, unknown> = { tenantId, branchId: branchId ?? null, dayOfWeek: input.dayOfWeek };
    for (const key of ["morningStartTime", "morningEndTime", "eveningStartTime", "eveningEndTime"]) {
      data[key] = input[key] ? new Date(`1970-01-01T${input[key]}:00Z`) : null;
    }
    return data;
  }

  if (resource === "testimonios") {
    const status = input.moderationStatus || "pending";
    return {
      tenantId,
      branchId: branchId ?? null,
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
    return promotionData(input, tenantId, undefined, branchId);
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
        "isPublicCaseStudy",
        "status",
      ]),
      slug: slugify(input.slug || input.businessName) || "caso",
      status: input.status || "published",
      isPublicCaseStudy: booleanValue(input.isPublicCaseStudy),
      sortOrder: Number(input.sortOrder || 0),
    };
  }

  if (resource === "sucursales") {
    if (!input.name?.trim() || !input.address?.trim()) {
      throw new Error("Completá el nombre y la dirección de la sucursal");
    }
    const firstBranch = (await prisma.branch.count({ where: { tenantId } })) === 0;
    return {
      tenantId,
      name: input.name.trim(),
      slug: slugify(input.slug || input.name) || "sucursal",
      address: input.address.trim(),
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      latitude: input.latitude ? Number(input.latitude) : null,
      longitude: input.longitude ? Number(input.longitude) : null,
      deliveryFee: Math.max(0, Number(input.deliveryFee || 0)),
      minimumOrder: Math.max(0, Number(input.minimumOrder || 0)),
      orderPrefix: input.orderPrefix?.trim().toUpperCase().slice(0, 12) || "PED",
      isPrimary: firstBranch || booleanValue(input.isPrimary),
      active: booleanValue(input.active),
      inheritLanding: input.inheritLanding === "" ? true : booleanValue(input.inheritLanding),
      inheritBrand: input.inheritBrand === "" ? true : booleanValue(input.inheritBrand),
      landingContent: { heroTitle: input.landingHeroTitle?.trim() || "", heroSubtitle: input.landingHeroSubtitle?.trim() || "" },
    };
  }

  if (resource === "seo") {
    const pagePath = input.path?.trim();
    if (!pagePath?.startsWith("/") || !input.title?.trim() || !input.description?.trim()) {
      throw new Error("Ingresá una ruta válida, título y descripción");
    }
    return {
      tenantId,
      path: pagePath,
      title: input.title.trim(),
      description: input.description.trim(),
      canonical: input.canonical?.trim() || null,
      ogImageUrl: input.ogImageUrl?.trim() || null,
      noIndex: booleanValue(input.noIndex),
    };
  }

  if (resource === "redirecciones") {
    if (!input.sourcePath?.startsWith("/") || !input.targetPath?.startsWith("/")) {
      throw new Error("Las rutas de origen y destino deben comenzar con /");
    }
    if (input.sourcePath === input.targetPath) throw new Error("El origen y el destino deben ser distintos");
    return {
      tenantId,
      sourcePath: input.sourcePath.trim(),
      targetPath: input.targetPath.trim(),
      permanent: booleanValue(input.permanent),
      active: booleanValue(input.active),
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
  const branchIds = (input.branchIds ?? "").split(",").map(Number).filter(Number.isInteger);
  const branches = await prisma.branch.findMany({ where: { tenantId, id: { in: branchIds } }, select: { id: true } });
  const allBranches = input.allBranches === "true";

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
    const membership = await transaction.tenantMembership.create({ data: { tenantId, userId: user.id, roleId, allBranches } });
    if (branches.length) {
      await transaction.branchMembership.createMany({
        data: branches.map((branch) => ({ membershipId: membership.id, branchId: branch.id })),
      });
    }
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
    if (resource === "productos") {
      await ensureTenantCapacity(auth.tenant.id, "products");
    }
    if (resource === "usuarios") {
      await ensureTenantCapacity(auth.tenant.id, "users");
    }
    if (resource === "sucursales") {
      await ensureTenantCapacity(auth.tenant.id, "branches");
      const branchCapacity = await assertBranchCapacity(auth.tenant.id);
      if (!branchCapacity.ok) throw new Error(branchCapacity.reason);
    }
    let item: unknown;
    const createBranchId = await resolveEffectiveBranchId(auth.tenant.id, auth.activeBranchId);
    if (resource === "usuarios") {
      item = await createMember(input, auth.tenant.id);
    } else if (resource === "productos") {
      const product = await productAdminData(input, auth.tenant.id, auth.activeBranchId);
      item = await prisma.product.create({ data: product.data });
      await ensureBranchProduct(auth.tenant.id, product.targetBranchId, (item as { id: number }).id);
      await ensureBranchStock(auth.tenant.id, product.targetBranchId, (item as { id: number }).id);
    } else {
      item = await (prisma[resourceConfig.model] as unknown as Delegate).create({
        data: await normalize(resource, input, auth.tenant.id, createBranchId ?? undefined),
      });
    }
    if (resource === "sucursales" && (item as { isPrimary?: boolean }).isPrimary) {
      await prisma.branch.updateMany({
        where: { tenantId: auth.tenant.id, id: { not: (item as { id: number }).id } },
        data: { isPrimary: false },
      });
    }
    if (resource === "sucursales") {
      const createdBranchId = (item as { id: number }).id;
      await prisma.branchMembership.createMany({
        data: (await prisma.tenantMembership.findMany({ where: { tenantId: auth.tenant.id }, select: { id: true } })).map(
          (membership) => ({ membershipId: membership.id, branchId: createdBranchId }),
        ),
        skipDuplicates: true,
      });
      await ensureDraftLicense(auth.tenant.id, createdBranchId);
    }
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
