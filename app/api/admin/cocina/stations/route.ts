import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const stationInput = z.object({
  branchId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  type: z.string().trim().max(20).default("KITCHEN"),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

/** @summary Adapta una estación de Prisma al formato plano que consume el monitor. */
function stationPayload(station: {
  id: number;
  name: string;
  type: string;
  active: boolean;
  sortOrder: number;
  branchId: number;
  _count: { products: number };
}) {
  return {
    id: station.id,
    name: station.name,
    type: station.type,
    active: station.active,
    sortOrder: station.sortOrder,
    branchId: station.branchId,
    productCount: station._count.products,
  };
}

/** @summary Devuelve las estaciones de cocina visibles en el contexto de sucursal actual. */
export async function GET() {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const activeId = auth.activeBranchId && auth.activeBranchId > 0 ? auth.activeBranchId : null;
  const branchIds = auth.branches.map((branch) => branch.id);
  const stations = await prisma.kitchenStation.findMany({
    where: {
      tenantId: auth.tenant.id,
      ...(activeId ? { branchId: activeId } : { branchId: { in: branchIds } }),
    },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ stations: stations.map(stationPayload) });
}

/** @summary Crea una estación de cocina para la sucursal indicada, verificando el acceso. */
export async function POST(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = stationInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "Revisá los datos de la estación" }, { status: 400 });
  }
  const name = parsed.data.name.trim();
  const existing = await prisma.kitchenStation.findFirst({
    where: { tenantId: auth.tenant.id, branchId: parsed.data.branchId, name },
  });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una estación con ese nombre" }, { status: 409 });
  }
  const station = await prisma.kitchenStation.create({
    data: {
      tenantId: auth.tenant.id,
      branchId: parsed.data.branchId,
      name,
      type: parsed.data.type || "KITCHEN",
      sortOrder: parsed.data.sortOrder ?? 0,
    },
    include: { _count: { select: { products: true } } },
  });
  await recordAudit({
    context: auth,
    action: "kitchen-station.create",
    entityType: "kitchen-station",
    entityId: station.id,
    newValues: toAuditValue(serialize(station)),
    request,
  });
  return NextResponse.json({ station: stationPayload(station) }, { status: 201 });
}
