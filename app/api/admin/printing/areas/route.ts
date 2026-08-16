import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const areaInput = z.object({
  branchId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** @summary Crea un área de impresión para la sucursal indicada, verificando el acceso. */
export async function POST(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = areaInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "Revisá los datos del área" }, { status: 400 });
  }
  const name = parsed.data.name.trim();
  const existing = await prisma.printArea.findFirst({
    where: { tenantId: auth.tenant.id, branchId: parsed.data.branchId, name },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un área con ese nombre" }, { status: 409 });
  }
  const area = await prisma.printArea.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: parsed.data.branchId,
      name,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  await recordAudit({
    context: auth,
    action: "print-area.create",
    entityType: "print-area",
    entityId: area.id,
    newValues: toAuditValue(serialize(area)),
    request,
  });
  return NextResponse.json({ area: serialize(area) }, { status: 201 });
}
