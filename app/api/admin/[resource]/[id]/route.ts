import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminResource } from "@/lib/admin-resources";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { resourceScopedWhere } from "@/lib/branch";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { productAdminData } from "@/lib/product-admin";
import { promotionData } from "@/lib/promotion-admin";
import { slugify, uniqueCategorySlug } from "@/lib/slug";

const inputSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
type Delegate = {
  findFirst(args: { where: Record<string, unknown> }): Promise<unknown>;
  update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: number } }): Promise<unknown>;
};

/** @summary Filtro de pertenencia tenant + branch activa según la clasificación de cada recurso. */
function itemBranchWhere(auth: NonNullable<Awaited<ReturnType<typeof authorize>>>, model: string): Record<string, unknown> {
  return resourceScopedWhere(model, auth?.tenant.id, auth?.activeBranchId);
}

/** @summary Convierte una entrada de formulario en un valor booleano explícito. */
function booleanValue(value: string) {
  return value === "true" || value === "1" || value === "on";
}

/** @summary Copia únicamente los campos editables del recurso solicitado. */
function selectFields(input: Record<string, string>, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, input[field] ?? ""]));
}

/** @summary Convierte los campos editados a los tipos esperados por cada modelo de Prisma. */
async function values(resource: string, input: Record<string, string>, tenantId: number, id: number, branchId?: number) {
  if (resource === "productos") {
    const { data } = await productAdminData(input, tenantId, branchId, { excludeId: id });
    return { ...data, categories: { deleteMany: {}, ...data.categories } };
  }

  if (resource === "categorias") {
    const fields = selectFields(input, ["name", "description", "imageUrl", "status"]);
    return {
      ...fields,
      status: fields.status || "published",
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      slug: await uniqueCategorySlug(tenantId, input.slug || fields.name, id),
      sortOrder: Number(input.sortOrder || 0),
    };
  }

  if (resource === "eventos") {
    return {
      ...selectFields(input, ["name", "description", "location", "imageUrl", "status"]),
      status: input.status || "published",
      publishAt: input.publishAt ? new Date(input.publishAt) : null,
      date: input.date ? new Date(`${input.date}T00:00:00`) : null,
      time: input.time ? new Date(`1970-01-01T${input.time}:00Z`) : null,
    };
  }

  if (resource === "horarios") {
    const data: Record<string, unknown> = { dayOfWeek: input.dayOfWeek };
    for (const key of ["morningStartTime", "morningEndTime", "eveningStartTime", "eveningEndTime"]) {
      data[key] = input[key] ? new Date(`1970-01-01T${input[key]}:00Z`) : null;
    }
    return data;
  }

  if (resource === "testimonios") {
    const status = input.moderationStatus || "pending";
    return {
      description: input.description,
      moderationStatus: status,
      state: status === "approved",
    };
  }

  if (resource === "negocio") {
    return {
      ...selectFields(input, ["address", "email", "latitude", "longitude", "instagramUrl", "facebookUrl"]),
      phoneNumber: input.phoneNumber ? BigInt(input.phoneNumber.replace(/\D/g, "")) : null,
    };
  }

  if (resource === "promociones") {
    const data = await promotionData(input, tenantId, id, branchId);
    return {
      ...data,
      products: { deleteMany: {}, ...data.products },
      categories: { deleteMany: {}, ...data.categories },
    };
  }

  if (resource === "legales") {
    return {
      title: input.title.trim(),
      slug: slugify(input.slug || input.title) || `pagina-${id}`,
      content: input.content.trim(),
      status: input.status || "published",
    };
  }

  if (resource === "ayuda") {
    return {
      title: input.title.trim(),
      slug: slugify(input.slug || input.title) || `articulo-${id}`,
      summary: input.summary.trim(),
      content: input.content.trim(),
      category: input.category?.trim() || "General",
      audience: ["public", "admin", "all"].includes(input.audience) ? input.audience : "public",
      status: input.status || "published",
      displayOrder: Number(input.displayOrder || 0),
    };
  }

  if (resource === "casos") {
    return {
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
      slug: slugify(input.slug || input.businessName) || `caso-${id}`,
      status: input.status || "published",
      isPublicCaseStudy: booleanValue(input.isPublicCaseStudy),
      sortOrder: Number(input.sortOrder || 0),
    };
  }

  if (resource === "sucursales") {
    if (!input.name?.trim() || !input.address?.trim()) {
      throw new Error("Completá el nombre y la dirección de la sucursal");
    }
    // El slug es la identidad estable de la sucursal: solo cambia si se edita
    // explícitamente. Un slug vacío conserva el actual (nunca se regenera desde el nombre).
    const nextSlug = input.slug?.trim() ? slugify(input.slug.trim()) : "";
    return {
      name: input.name.trim(),
      ...(nextSlug ? { slug: nextSlug } : {}),
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
      isPrimary: booleanValue(input.isPrimary),
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
      sourcePath: input.sourcePath.trim(),
      targetPath: input.targetPath.trim(),
      permanent: booleanValue(input.permanent),
      active: booleanValue(input.active),
    };
  }

  throw new Error("El recurso necesita un flujo de edición específico");
}

/** @summary Resuelve y valida los parámetros dinámicos de una operación administrativa. */
async function contextData(context: { params: Promise<{ resource: string; id: string }> }) {
  const params = await context.params;
  return { resource: params.resource, id: Number(params.id), config: getAdminResource(params.resource) };
}

/** @summary Actualiza un miembro y su rol sin exponer usuarios pertenecientes a otros negocios. */
async function updateMember(input: Record<string, string>, tenantId: number, userId: number) {
  const membership = await prisma.tenantMembership.findFirst({ where: { tenantId, userId } });
  if (!membership) throw new Error("Usuario no encontrado");
  const roleId = Number(input.roleId);
  const role = await prisma.role.findFirst({ where: { id: roleId, tenantId } });
  if (!role) throw new Error("Seleccioná un rol válido");
  const branchIds = (input.branchIds ?? "").split(",").map(Number).filter(Number.isInteger);
  const branches = await prisma.branch.findMany({ where: { tenantId, id: { in: branchIds } }, select: { id: true } });
  const allBranches = input.allBranches === "true";

  return prisma.$transaction(async (transaction) => {
    await transaction.tenantMembership.update({ where: { id: membership.id }, data: { roleId, allBranches } });
      const user = await transaction.user.update({
      where: { id: userId },
      data: {
        name: input.name.trim(),
        email: z.string().trim().email().parse(input.email).toLocaleLowerCase("es"),
        imageUrl: input.imageUrl || "avatar_profile_default.png",
        role: ["owner", "administrator"].includes(role.key) ? 1 : 0,
        ...(input.password
          ? { password: await bcrypt.hash(z.string().min(8).parse(input.password), 12) }
          : {}),
      },
      });
      await transaction.branchMembership.deleteMany({ where: { membershipId: membership.id } });
      if (branches.length) await transaction.branchMembership.createMany({ data: branches.map((branch) => ({ membershipId: membership.id, branchId: branch.id })) });
      return { ...user, roleId: roleId.toString(), roleName: role.name, password: "" };
  });
}

/** @summary Actualiza un registro después de verificar el permiso y la pertenencia al negocio. */
export async function PUT(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id, config } = await contextData(context);
  if (!config || !Number.isInteger(id))
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  const auth = await authorize(config.permission);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const input = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, value === null ? "" : String(value)]),
  );

  try {
    if (resource === "usuarios") {
      const oldItem = await prisma.tenantMembership.findFirst({
        where: { tenantId: auth.tenant.id, userId: id },
        include: { user: true, role: true },
      });
      if (!oldItem) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
      const item = await updateMember(input, auth.tenant.id, id);
      await prisma.authSession.updateMany({
        where: { userId: id, membershipId: oldItem.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const safeUser = { ...oldItem.user, password: undefined };
      await recordAudit({
        context: auth,
        action: "update",
        entityType: resource,
        entityId: id,
        oldValues: toAuditValue(serialize({ ...oldItem, user: safeUser })),
        newValues: toAuditValue(serialize(item)),
        request,
      });
      return NextResponse.json({ item: serialize(item) });
    }

    const delegate = prisma[config.model] as unknown as Delegate;
    const oldItem = await delegate.findFirst({ where: { ...itemBranchWhere(auth, config.model), id } });
    if (!oldItem) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    const data = await values(resource, input, auth.tenant.id, id, auth.activeBranchId);
    if (resource === "sucursales" && data.slug && data.slug !== (oldItem as { slug?: string }).slug) {
      const collision = await prisma.branch.findFirst({
        where: { tenantId: auth.tenant.id, slug: data.slug as string, id: { not: id } },
        select: { id: true },
      });
      if (collision) throw new Error("Ya existe una sucursal con ese identificador");
    }
    const item =
      resource === "sucursales"
        ? await prisma.$transaction(async (transaction) => {
            const wasPrimary = Boolean((oldItem as { isPrimary?: boolean }).isPrimary);
            const becomesPrimary = Boolean((data as { isPrimary: boolean }).isPrimary);
            if (wasPrimary && !becomesPrimary) {
              const others = await transaction.branch.count({ where: { tenantId: auth.tenant.id, id: { not: id } } });
              if (!others) (data as Record<string, unknown>).isPrimary = true;
              else throw new Error("Asigná otra sucursal principal antes de desmarcar esta");
            }
            const updated = await transaction.branch.update({ where: { id }, data });
            if (becomesPrimary) {
              await transaction.branch.updateMany({
                where: { tenantId: auth.tenant.id, id: { not: id } },
                data: { isPrimary: false },
              });
            }
            return updated;
          })
        : await delegate.update({ where: { id }, data });
    if (resource === "productos") {
      const targetBranchId = auth.activeBranchId && auth.activeBranchId > 0 ? auth.activeBranchId : null;
      if (targetBranchId) {
        await prisma.branchProduct.upsert({
          where: { branchId_productId: { branchId: targetBranchId, productId: id } },
          create: { tenantId: auth.tenant.id, branchId: targetBranchId, productId: id, active: true },
          update: { tenantId: auth.tenant.id },
        });
      }
    }
    await recordAudit({
      context: auth,
      action: "update",
      entityType: resource,
      entityId: id,
      oldValues: toAuditValue(serialize(oldItem)),
      newValues: toAuditValue(serialize(item)),
      request,
    });
    return NextResponse.json({ item: serialize(item) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el registro" },
      { status: 400 },
    );
  }
}

/** @summary Elimina un registro autorizado conservando la integridad de sus relaciones. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  const { resource, id, config } = await contextData(context);
  if (!config || !Number.isInteger(id))
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  const auth = await authorize(config.permission);
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (resource === "usuarios" && id === auth.session.userId) {
    return NextResponse.json({ error: "No podés eliminar tu propio acceso" }, { status: 400 });
  }

  try {
    if (resource === "usuarios") {
      const membership = await prisma.tenantMembership.findFirst({
        where: { tenantId: auth.tenant.id, userId: id },
        include: { user: true, role: true },
      });
      if (!membership) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
      const safeUser = { ...membership.user, password: undefined };
      await prisma.$transaction(async (transaction) => {
        await transaction.tenantMembership.delete({ where: { id: membership.id } });
        const remaining = await transaction.tenantMembership.count({ where: { userId: id } });
        if (!remaining) await transaction.user.delete({ where: { id } });
      });
      await recordAudit({
        context: auth,
        action: "delete",
        entityType: resource,
        entityId: id,
        oldValues: toAuditValue(serialize({ ...membership, user: safeUser })),
        request,
      });
      return new NextResponse(null, { status: 204 });
    }

    const delegate = prisma[config.model] as unknown as Delegate;
    const oldItem = await delegate.findFirst({ where: { ...itemBranchWhere(auth, config.model), id } });
    if (!oldItem) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    if (resource === "sucursales" && (oldItem as { isPrimary?: boolean }).isPrimary) {
      return NextResponse.json(
        { error: "Asigná otra sucursal principal antes de eliminarla" },
        { status: 409 },
      );
    }

    if (resource === "productos") {
      if (auth.activeBranchId && auth.activeBranchId > 0) {
        await prisma.$transaction([
          prisma.productCategory.deleteMany({
            where: { productId: id, tenantId: auth.tenant.id, category: { branchId: auth.activeBranchId } },
          }),
          prisma.branchProduct.deleteMany({ where: { productId: id, branchId: auth.activeBranchId, tenantId: auth.tenant.id } }),
          prisma.inventoryStock.deleteMany({ where: { productId: id, branchId: auth.activeBranchId, tenantId: auth.tenant.id } }),
        ]);
      } else {
        await prisma.$transaction([
          prisma.productCategory.deleteMany({ where: { productId: id, tenantId: auth.tenant.id } }),
          prisma.branchProduct.deleteMany({ where: { productId: id, tenantId: auth.tenant.id } }),
          prisma.inventoryStock.deleteMany({ where: { productId: id, tenantId: auth.tenant.id } }),
          prisma.product.delete({ where: { id } }),
        ]);
      }
    } else if (resource === "categorias") {
      await prisma.$transaction([
        prisma.productCategory.deleteMany({ where: { categoryId: id, tenantId: auth.tenant.id } }),
        prisma.category.delete({ where: { id } }),
      ]);
    } else {
      await delegate.delete({ where: { id } });
    }

    await recordAudit({
      context: auth,
      action: "delete",
      entityType: resource,
      entityId: id,
      oldValues: toAuditValue(serialize(oldItem)),
      request,
    });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar el registro. Puede que tenga otra relación protegida." },
      { status: 409 },
    );
  }
}
