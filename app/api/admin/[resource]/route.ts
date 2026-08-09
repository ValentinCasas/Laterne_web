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
type Delegate = { create(args: { data: Record<string, unknown> }): Promise<unknown> };

/** @summary Normaliza los datos recibidos antes de crear un recurso administrativo. */
function normalize(resource: string, input: Record<string, string>) {
  const data: Record<string, unknown> = { ...input };
  for (const key of Object.keys(data)) if (data[key] === "") data[key] = null;
  if (resource === "productos") data.price = input.price ? Number(input.price) : null;
  if (resource === "testimonios") {
    data.state = input.state === "true" || input.state === "1";
    data.date = new Date();
  }
  if (resource === "usuarios") {
    data.role = Number(input.role);
    data.imageUrl ||= "avatar_profile_default.png";
  }
  if (resource === "negocio" && input.phoneNumber) data.phoneNumber = BigInt(input.phoneNumber);
  if (resource === "eventos") {
    data.date = input.date ? new Date(`${input.date}T00:00:00`) : null;
    data.time = input.time ? new Date(`1970-01-01T${input.time}:00Z`) : null;
  }
  if (resource === "horarios")
    for (const key of ["morningStartTime", "morningEndTime", "eveningStartTime", "eveningEndTime"])
      data[key] = input[key] ? new Date(`1970-01-01T${input[key]}:00Z`) : null;
  return data;
}

/** @summary Crea un registro del recurso solicitado después de validar la sesión y sus datos. */
export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { resource } = await context.params;
  const model = models[resource as keyof typeof models];
  if (!model) return NextResponse.json({ error: "Recurso inválido" }, { status: 404 });
  const input = (await request.json()) as Record<string, string>;
  const data = normalize(resource, input);
  if (resource === "usuarios") {
    if (!input.password) return NextResponse.json({ error: "La contraseña es obligatoria" }, { status: 400 });
    data.password = await bcrypt.hash(input.password, 12);
  }
  const item = await (prisma[model] as unknown as Delegate).create({ data });
  return NextResponse.json({ item: serialize(item) }, { status: 201 });
}
