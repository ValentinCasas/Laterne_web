import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const planSchema = z.object({
  name: z.string().trim().min(3).max(140),
  slug: z.string().trim().max(100).optional(),
  summary: z.string().trim().min(10).max(500),
  audience: z.string().trim().max(255).optional(),
  type: z.enum(["implementation", "maintenance"]),
  billingMode: z.enum(["one_time", "monthly", "quote"]),
  badge: z.string().trim().max(80).optional(),
  highlighted: z.boolean().default(false),
  active: z.boolean().default(true),
  displayOrder: z.coerce.number().int().min(0).max(10000),
  currency: z.string().trim().length(3).default("ARS"),
  amount: z.coerce.number().nonnegative().nullable(),
  billingPeriod: z.enum(["once", "month"]),
  featureIds: z.array(z.number().int().positive()).max(200),
});

/** @summary Crea un plan comercial con precio y funcionalidades administrables. */
export async function POST(request: Request) {
  const auth = await authorize("plan.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = planSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Revisá la información del plan" }, { status: 400 });
  const data = parsed.data;
  const slug = slugify(data.slug || data.name);
  if (!slug) return NextResponse.json({ error: "Ingresá un nombre válido" }, { status: 400 });
  const featureCount = await prisma.feature.count({ where: { id: { in: data.featureIds }, active: true } });
  if (featureCount !== new Set(data.featureIds).size) {
    return NextResponse.json({ error: "Una de las funcionalidades no es válida" }, { status: 400 });
  }

  try {
    const plan = await prisma.plan.create({
      data: {
        slug,
        name: data.name,
        summary: data.summary,
        audience: data.audience || null,
        type: data.type,
        billingMode: data.billingMode,
        badge: data.badge || null,
        highlighted: data.highlighted,
        active: data.active,
        displayOrder: data.displayOrder,
        prices: {
          create: {
            currency: data.currency.toUpperCase(),
            amount: data.billingMode === "quote" ? null : data.amount,
            billingPeriod: data.billingPeriod,
          },
        },
        features: {
          create: data.featureIds.map((featureId, index) => ({ featureId, displayOrder: index * 10 })),
        },
      },
      include: { prices: true, features: { include: { feature: true } } },
    });
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "plan",
      entityId: plan.id,
      newValues: toAuditValue(plan),
      request,
    });
    revalidatePath("/planes");
    revalidatePath("/para-negocios");
    return NextResponse.json({ plan: toAuditValue(plan) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Ya existe un plan con esa dirección o los datos no son válidos" },
      { status: 409 },
    );
  }
}
