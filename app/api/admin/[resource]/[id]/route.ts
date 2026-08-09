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
  if (resource === "productos" && input.price) data.price = Number(input.price);
  if (resource === "testimonios") data.state = input.state === "true" || input.state === "1";
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
  const data = values(resource, input);
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
  const { id, model } = await contextData(context);
  if (!model || !Number.isInteger(id))
    return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  await (prisma[model] as unknown as Delegate).delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
