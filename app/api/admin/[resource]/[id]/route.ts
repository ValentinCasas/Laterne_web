import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const models = {
  productos: "product",
  categorias: "category",
  eventos: "event",
  horarios: "openingHour",
  testimonios: "testimonial",
  usuarios: "user",
  negocio: "businessInfo",
} as const;
type Delegate = {
  update(args: { where: { id: number }; data: Record<string, unknown> }): Promise<unknown>;
  delete(args: { where: { id: number } }): Promise<unknown>;
};

/** @summary Convierte los campos editados a los tipos esperados por cada modelo de Prisma. */
function values(resource: string, input: Record<string, string>) {
  const data: Record<string, unknown> = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== ""),
  );
  if (resource === "productos") {
    const categoryId = Number(input.categoryId);
    if (!Number.isInteger(categoryId) || categoryId < 1) throw new Error("Seleccioná una categoría válida");
    if (input.price) data.price = Number(input.price);
    data.categories = { deleteMany: {}, create: { categoryId } };
    delete data.categoryId;
  }
  if (resource === "testimonios") {
    const status =
      input.moderationStatus || (input.state === "true" || input.state === "1" ? "approved" : "pending");
    data.moderationStatus = status;
    data.state = status === "approved";
  }
  if (resource === "usuarios") data.role = Number(input.role);
  if (resource === "negocio" && input.phoneNumber) data.phoneNumber = BigInt(input.phoneNumber);
  if (resource === "eventos") {
    if (input.date) data.date = new Date(`${input.date}T00:00:00`);
    if (input.time) data.time = new Date(`1970-01-01T${input.time}:00Z`);
  }
  if (resource === "horarios")
    for (const key of ["morningStartTime", "morningEndTime", "eveningStartTime", "eveningEndTime"])
      if (input[key]) data[key] = new Date(`1970-01-01T${input[key]}:00Z`);
  return data;
}

/** @summary Resuelve el recurso, el identificador y el modelo asociados a una ruta dinámica. */
async function contextData(context: { params: Promise<{ resource: string; id: string }> }) {
  const params = await context.params;
  return {
    resource: params.resource,
    id: Number(params.id),
    model: models[params.resource as keyof typeof models],
  };
}

/** @summary Actualiza un registro existente después de comprobar la sesión del usuario. */
export async function PUT(request: Request, context: { params: Promise<{ resource: string; id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { resource, id, model } = await contextData(context);
  if (!model || !Number.isInteger(id))
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  const input = (await request.json()) as Record<string, string>;
  let data: Record<string, unknown>;
  try {
    data = values(resource, input);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Datos inválidos" },
      { status: 400 },
    );
  }
  if (resource === "usuarios") {
    if (input.password) data.password = await bcrypt.hash(input.password, 12);
    else delete data.password;
  }
  const item = await (prisma[model] as unknown as Delegate).update({ where: { id }, data });
  return NextResponse.json({ item: serialize(item) });
}

/** @summary Elimina un registro cuando la solicitud pertenece a un administrador autorizado. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ resource: string; id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 1) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { resource, id, model } = await contextData(context);
  if (!model || !Number.isInteger(id))
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });

  try {
    if (resource === "productos") {
      await prisma.$transaction([
        prisma.productCategory.deleteMany({ where: { productId: id } }),
        prisma.product.delete({ where: { id } }),
      ]);
      return new NextResponse(null, { status: 204 });
    }

    if (resource === "categorias") {
      await prisma.$transaction([
        prisma.productCategory.deleteMany({ where: { categoryId: id } }),
        prisma.category.delete({ where: { id } }),
      ]);
      return new NextResponse(null, { status: 204 });
    }

    await (prisma[model] as unknown as Delegate).delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json(
      { error: "No se pudo eliminar el registro. Puede que ya no exista o tenga otra relación protegida." },
      { status: 409 },
    );
  }
}
