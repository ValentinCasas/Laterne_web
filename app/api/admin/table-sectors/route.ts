import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createTableSector, TableServiceError } from "@/lib/table-sessions";

const sectorInput = z.object({
  branchId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** @summary Lista los sectores del salón visibles en el contexto de sucursal actual. */
export async function GET() {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const activeId = auth.activeBranchId && auth.activeBranchId > 0 ? auth.activeBranchId : null;
  const branchIds = auth.branches.map((branch) => branch.id);
  const sectors = await prisma.tableSector.findMany({
    where: {
      tenantId: auth.tenant.id,
      ...(activeId ? { branchId: activeId } : { branchId: { in: branchIds } }),
    },
    orderBy: [{ branchId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ sectors: serialize(sectors) });
}

/** @summary Crea un sector del salón para la sucursal indicada. */
export async function POST(request: Request) {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = sectorInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del sector" }, { status: 400 });
  try {
    const result = await createTableSector(auth, parsed.data);
    await recordAudit({
      context: auth,
      action: "sector.create",
      entityType: "table-sector",
      entityId: result.sector.id,
      newValues: toAuditValue(serialize(result.sector)),
      request,
    });
    return NextResponse.json({ sector: serialize(result.sector) }, { status: 201 });
  } catch (reason) {
    if (reason instanceof TableServiceError) {
      return NextResponse.json({ error: reason.message }, { status: reason.status });
    }
    throw reason;
  }
}
