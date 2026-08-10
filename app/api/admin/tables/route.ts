import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { tableCode } from "@/lib/tables";

const tableInput = z.object({
  name: z.string().trim().min(1).max(100),
  sector: z.string().trim().max(100).optional(),
  capacity: z.coerce.number().int().min(1).max(100),
  active: z.boolean().default(true),
  branchId: z.coerce.number().int().positive(),
});

/** @summary Genera un código de mesa que todavía no existe dentro del negocio actual. */
async function uniqueCode(tenantId: number, name: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = tableCode(name);
    const exists = await prisma.diningTable.findUnique({
      where: { tenantId_code: { tenantId, code } },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("No se pudo generar el código de mesa");
}

/** @summary Crea una mesa aislada por negocio y registra la operación administrativa. */
export async function POST(request: Request) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = tableInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la mesa" }, { status: 400 });
  const branch = await prisma.branch.findFirst({
    where: { id: parsed.data.branchId, tenantId: auth.tenant.id },
  });
  if (!branch) return NextResponse.json({ error: "Seleccioná una sucursal válida" }, { status: 400 });
  const created = await prisma.diningTable.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: branch.id,
      code: await uniqueCode(auth.tenant.id, parsed.data.name),
      name: parsed.data.name,
      sector: parsed.data.sector || null,
      capacity: parsed.data.capacity,
      active: parsed.data.active,
    },
  });
  await recordAudit({
    context: auth,
    action: "create",
    entityType: "dining-table",
    entityId: created.id,
    newValues: toAuditValue(serialize(created)),
    request,
  });
  return NextResponse.json({ table: serialize(created) }, { status: 201 });
}
