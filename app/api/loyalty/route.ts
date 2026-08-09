import { NextResponse } from "next/server";
import { z } from "zod";
import { loyaltyToken, loyaltyTokenHash } from "@/lib/loyalty";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

const registrationInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    email: z.string().trim().email().max(190).optional().or(z.literal("")),
    phone: z.string().trim().min(6).max(60).optional().or(z.literal("")),
    birthday: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
    consent: z.literal(true),
    website: z.string().max(0).optional(),
  })
  .refine((value) => value.email || value.phone, { message: "Indicá email o teléfono" });

/** @summary Recupera el token de cliente enviado mediante un encabezado privado. */
function requestToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

/** @summary Devuelve un perfil frecuente, sus movimientos y pedidos sin revelar el token almacenado. */
export async function GET(request: Request) {
  const token = requestToken(request);
  if (token.length < 20) return NextResponse.json({ error: "Acceso inválido" }, { status: 401 });
  const tenant = await getDefaultTenant();
  const customer = await prisma.loyaltyCustomer.findFirst({
    where: { tenantId: tenant.id, publicTokenHash: loyaltyTokenHash(token), deletedAt: null },
    select: {
      name: true,
      email: true,
      phone: true,
      birthday: true,
      points: true,
      tier: true,
      createdAt: true,
      transactions: { orderBy: { createdAt: "desc" }, take: 30 },
      orders: {
        select: { reference: true, status: true, total: true, currency: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
  if (!customer) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  return NextResponse.json({
    customer: JSON.parse(
      JSON.stringify(customer, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
    ),
  });
}

/** @summary Registra un perfil frecuente nuevo y entrega una credencial que solo conserva el cliente. */
export async function POST(request: Request) {
  const parsed = registrationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Revisá tus datos y el consentimiento" }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });
  const tenant = await getDefaultTenant();
  const email = parsed.data.email?.toLocaleLowerCase("es") || null;
  const phone = parsed.data.phone?.replace(/\s+/g, "") || null;
  const exists = await prisma.loyaltyCustomer.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    },
  });
  if (exists)
    return NextResponse.json(
      { error: "Ya existe un perfil con esos datos. Usá el acceso guardado en este dispositivo." },
      { status: 409 },
    );
  const token = loyaltyToken();
  const customer = await prisma.loyaltyCustomer.create({
    data: {
      tenantId: tenant.id,
      publicTokenHash: loyaltyTokenHash(token),
      name: parsed.data.name,
      email,
      phone,
      birthday: parsed.data.birthday ? new Date(`${parsed.data.birthday}T00:00:00Z`) : null,
      consentAt: new Date(),
    },
    select: { name: true, points: true, tier: true },
  });
  return NextResponse.json({ ok: true, token, customer }, { status: 201 });
}

/** @summary Anonimiza el perfil solicitado y elimina su historial de puntos a pedido del titular. */
export async function DELETE(request: Request) {
  const token = requestToken(request);
  if (token.length < 20) return NextResponse.json({ error: "Acceso inválido" }, { status: 401 });
  const tenant = await getDefaultTenant();
  const customer = await prisma.loyaltyCustomer.findFirst({
    where: { tenantId: tenant.id, publicTokenHash: loyaltyTokenHash(token), deletedAt: null },
  });
  if (!customer) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  await prisma.$transaction([
    prisma.loyaltyTransaction.deleteMany({ where: { customerId: customer.id } }),
    prisma.loyaltyCustomer.update({
      where: { id: customer.id },
      data: {
        name: "Perfil eliminado",
        email: null,
        phone: null,
        birthday: null,
        points: 0,
        tier: "eliminado",
        deletedAt: new Date(),
        publicTokenHash: loyaltyTokenHash(`deleted:${customer.id}:${Date.now()}`),
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
