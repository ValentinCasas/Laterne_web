import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * @summary Conversiones de unidades personalizadas del negocio.
 *
 * Complementan las estándar (g/kg, ml/l, unidad) cuando el negocio compra en
 * unidades propias (p. ej. 1 bolsa = 25 kg). GET lista; PUT reemplaza el
 * conjunto completo del tenant de forma atómica.
 */

const conversionsInput = z.object({
  rows: z
    .array(
      z.object({
        fromUnit: z.string().trim().min(1).max(40),
        toUnit: z.string().trim().min(1).max(40),
        factor: z.coerce.number().positive().max(1_000_000_000),
      }),
    )
    .max(200),
});

/** @summary Lista las conversiones personalizadas del tenant. */
export async function GET() {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const rows = await prisma.unitConversion.findMany({
    where: { tenantId: auth.tenant.id },
    select: { id: true, fromUnit: true, toUnit: true, factor: true },
    orderBy: [{ fromUnit: "asc" }, { toUnit: "asc" }],
  });
  return NextResponse.json({
    rows: rows.map((row) => ({ ...row, factor: String(Number(row.factor)) })),
  });
}

/** @summary Reemplaza el conjunto de conversiones del tenant validando formato. */
export async function PUT(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = conversionsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá las conversiones" }, { status: 400 });

  const rows = parsed.data.rows
    .map((row) => ({
      fromUnit: row.fromUnit.trim().toLocaleLowerCase("es"),
      toUnit: row.toUnit.trim().toLocaleLowerCase("es"),
      factor: row.factor,
    }))
    .filter((row) => row.fromUnit && row.toUnit && row.fromUnit !== row.toUnit);

  const previous = await prisma.unitConversion.findMany({ where: { tenantId: auth.tenant.id } });
  await prisma.$transaction([
    prisma.unitConversion.deleteMany({ where: { tenantId: auth.tenant.id } }),
    prisma.unitConversion.createMany({
      data: rows.map((row) => ({ ...row, tenantId: auth.tenant.id })),
    }),
  ]);

  await recordAudit({
    context: auth,
    action: "conversions.update",
    entityType: "conversiones",
    entityId: auth.tenant.id,
    oldValues: toAuditValue(previous),
    newValues: toAuditValue(rows),
    request,
  });
  return NextResponse.json({ count: rows.length });
}
