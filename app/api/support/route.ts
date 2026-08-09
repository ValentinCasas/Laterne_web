import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

const ticketInput = z.object({
  customerName: z.string().trim().min(2).max(160),
  email: z
    .string()
    .trim()
    .email()
    .max(190)
    .transform((value) => value.toLocaleLowerCase("es")),
  phone: z.string().trim().max(60).optional(),
  category: z.string().trim().min(2).max(100),
  subject: z.string().trim().min(3).max(220),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional(),
});

/** @summary Genera una referencia breve para identificar una consulta de soporte. */
function ticketReference() {
  return `SOP-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/** @summary Guarda una consulta de ayuda con protección básica y notifica al panel. */
export async function POST(request: Request) {
  const parsed = ticketInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Revisá los datos de la consulta" }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });
  const tenant = await getDefaultTenant();
  const recent = await prisma.supportTicket.count({
    where: {
      tenantId: tenant.id,
      email: parsed.data.email,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recent >= 3)
    return NextResponse.json({ error: "Alcanzaste el límite temporal de consultas" }, { status: 429 });
  let reference = ticketReference();
  while (await prisma.supportTicket.findUnique({ where: { reference }, select: { id: true } }))
    reference = ticketReference();
  await prisma.$transaction([
    prisma.supportTicket.create({
      data: {
        tenantId: tenant.id,
        reference,
        status: "open",
        category: parsed.data.category,
        customerName: parsed.data.customerName,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        subject: parsed.data.subject,
        message: parsed.data.message,
      },
    }),
    prisma.notification.create({
      data: {
        tenantId: tenant.id,
        type: "support.new",
        title: `Nueva consulta · ${reference}`,
        message: parsed.data.subject,
        link: "/admin/soporte",
      },
    }),
  ]);
  return NextResponse.json({ ok: true, reference }, { status: 201 });
}
