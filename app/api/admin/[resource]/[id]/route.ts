import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminResource } from "@/lib/admin-resources";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { uniqueCategorySlug, uniqueProductSlug } from "@/lib/slug";

const inputSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));
type Delegate = {
  findFirst(args: { where: Record<string, unknown> }): Promise<unknown>;
  update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: number } }): Promise<unknown>;
};

/** @summary Convierte una entrada de formulario en un valor booleano explícito. */
function booleanValue(value: string) {
  return value === "true" || value === "1" || value === "on";
}

/** @summary Copia únicamente los campos editables del recurso solicitado. */
function selectFields(input: Record<string, string>, fields: string[]) {
  return Object.fromEntries(fields.map((field) => [field, input[field] ?? ""]));
}

/** @summary Convierte los campos editados a los tipos esperados por cada modelo de Prisma. */
async function values(resource: string, input: Record<string, string>, tenantId: number, id: number) {
  if (resource === "productos") {
    const categoryId = Number(input.categoryId);
    const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } });
    if (!category) throw new Error("Seleccioná una categoría válida");
    const fields = selectFields(input, ["name", "description", "availability", "imageUrl", "status"]);
    return {
      ...fields,
      status: fields.status || "published",
      slug: await uniqueProductSlug(tenantId, input.slug || fields.name, id),
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
      categories: { deleteMany: {}, create: { tenantId, categoryId } },
    };
  }

  if (resource === "categorias") {
    const fields = selectFields(input, ["name", "description", "imageUrl", "status"]);
    return {
      ...fields,
      status: fields.status || "published",
      slug: await uniqueCategorySlug(tenantId, input.slug || fields.name, id),
      sortOrder: Number(input.sortOrder || 0),
    };
  }

  if (resource === "eventos") {
    return {
      ...selectFields(input, ["name", "description", "location", "imageUrl", "status"]),
      status: input.status || "published",
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

  return prisma.$transaction(async (transaction) => {
    await transaction.tenantMembership.update({ where: { id: membership.id }, data: { roleId } });
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
    const oldItem = await delegate.findFirst({ where: { id, tenantId: auth.tenant.id } });
    if (!oldItem) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    const item = await delegate.update({
      where: { id },
      data: await values(resource, input, auth.tenant.id, id),
    });
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
    const oldItem = await delegate.findFirst({ where: { id, tenantId: auth.tenant.id } });
    if (!oldItem) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

    if (resource === "productos") {
      await prisma.$transaction([
        prisma.productCategory.deleteMany({ where: { productId: id, tenantId: auth.tenant.id } }),
        prisma.product.delete({ where: { id } }),
      ]);
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
