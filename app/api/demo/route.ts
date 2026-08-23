import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";
import { getConfig } from "@/lib/config";

/**
 * @summary Valida la entrada relacionada con las solicitudes de demostración.
 */
const demoSchema = z.object({
  fullName: z.string().trim().min(3).max(160),
  businessName: z.string().trim().min(2).max(180),
  businessType: z.string().trim().min(2).max(80),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(6).max(60),
  email: z.string().trim().email().max(190),
  approximateProducts: z.coerce.number().int().min(0).max(100000).optional(),
  branches: z.coerce.number().int().min(1).max(1000).default(1),
  planId: z.coerce.number().int().positive().optional(),
  requiredFeatures: z.array(z.string().trim().max(100)).max(30).default([]),
  approximateBudget: z.string().trim().max(100).optional(),
  message: z.string().trim().max(2000).optional(),
  consent: z.literal(true),
  source: z.string().trim().max(100).default("solicitar-demo"),
  website: z.string().max(0).optional(),
});

/** @summary Obtiene la dirección de red más confiable disponible detrás de proxies conocidos. */
function requestAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** @summary Genera una referencia irreversible para limitar abuso sin conservar la IP original. */
function hashAddress(address: string) {
  return createHash("sha256")
    .update(`${getConfig().authSecret}:${address}`)
    .digest("hex");
}

/** @summary Guarda una solicitud comercial validada y devuelve un acceso opcional a WhatsApp. */
export async function POST(request: Request) {
  const parsed = demoSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los campos marcados e intentá nuevamente." }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ ok: true }, { status: 201 });

  const address = requestAddress(request);
  const ipHash = hashAddress(address);
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const isDevelopment = process.env.NODE_ENV === "development";
  const [recentAddress, recentEmail] = await Promise.all([
    isDevelopment || address === "unknown"
      ? 0
      : prisma.salesLead.count({ where: { ipHash, createdAt: { gte: since } } }),
    isDevelopment
      ? 0
      : prisma.salesLead.count({
          where: { email: parsed.data.email.toLocaleLowerCase("es"), createdAt: { gte: since } },
        }),
  ]);
  if (recentAddress >= 5 || recentEmail >= 3) {
    return NextResponse.json(
      { error: "Recibimos varias solicitudes. Probá nuevamente más tarde." },
      { status: 429 },
    );
  }

  if (parsed.data.planId) {
    const plan = await prisma.plan.findFirst({ where: { id: parsed.data.planId, active: true } });
    if (!plan)
      return NextResponse.json({ error: "El plan seleccionado ya no está disponible." }, { status: 400 });
  }

  const lead = await prisma.$transaction(async (transaction) => {
    const created = await transaction.salesLead.create({
      data: {
        fullName: parsed.data.fullName,
        businessName: parsed.data.businessName,
        businessType: parsed.data.businessType,
        city: parsed.data.city,
        province: parsed.data.province,
        phone: parsed.data.phone,
        email: parsed.data.email.toLocaleLowerCase("es"),
        approximateProducts: parsed.data.approximateProducts,
        branches: parsed.data.branches,
        planId: parsed.data.planId,
        requiredFeatures: parsed.data.requiredFeatures,
        approximateBudget: parsed.data.approximateBudget,
        message: parsed.data.message,
        consent: parsed.data.consent,
        source: parsed.data.source,
        ipHash,
      },
    });
    await transaction.leadStatusHistory.create({
      data: { leadId: created.id, toStatus: "new", note: "Solicitud recibida desde el sitio público." },
    });
    return created;
  });

  const business = await getDefaultTenant()
    .then(async (tenant) => prisma.businessInfo.findUnique({ where: { tenantId: tenant.id } }))
    .catch(() => null);
  const phone = business?.phoneNumber?.toString() ?? "";
  const message = `Hola, soy ${lead.fullName} de ${lead.businessName}. Acabo de solicitar una demostración de Laterne Web (consulta #${lead.id}).`;

  return NextResponse.json(
    {
      ok: true,
      leadId: lead.id,
      whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null,
    },
    { status: 201 },
  );
}
