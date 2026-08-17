import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const driverDeliveriesInput = z.object({
  status: z.string().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  onlyIncidents: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * @summary Lista entregas históricas de un repartidor con filtros.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("driver.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverId = Number((await context.params).id);
  if (!Number.isInteger(driverId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const driver = await prisma.driverProfile.findFirst({ where: { id: driverId, tenantId: auth.tenant.id }, include: { branches: true } });
  if (!driver) return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });

  const accessibleBranchIds = auth.branches.map((b) => b.id);
  const driverBranchIds = driver.branches.map((db) => db.branchId);
  const hasAccess = auth.allBranches || driverBranchIds.some((bid) => accessibleBranchIds.includes(bid));
  if (!hasAccess) return NextResponse.json({ error: "No tenés acceso a este repartidor" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = driverDeliveriesInput.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  const { status, branchId, from, to, onlyIncidents, limit, offset } = parsed.data;

  const where: Record<string, unknown> = { tenantId: auth.tenant.id, driverProfileId: driverId };
  if (status) where.status = status;
  if (branchId) {
    if (!accessibleBranchIds.includes(branchId)) return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
    where.branchId = branchId;
  }
  if (from || to) {
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    where.createdAt = dateFilter;
  }
  if (onlyIncidents) where.incidents = { some: {} };

  const [deliveries, total] = await Promise.all([
    prisma.orderDelivery.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true } },
        order: { select: { id: true, reference: true, customerName: true } },
        incidents: { select: { id: true, type: true, description: true, resolved: true, reportedAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.orderDelivery.count({ where }),
  ]);

  const deliveriesWithDetails = deliveries.map((d) => {
    const assignedAt = d.assignedAt ? new Date(d.assignedAt).getTime() : null;
    const pickedUpAt = d.pickedUpAt ? new Date(d.pickedUpAt).getTime() : null;
    const deliveredAt = d.deliveredAt ? new Date(d.deliveredAt).getTime() : null;

    let pickupMinutes = null;
    let deliveryMinutes = null;
    let totalMinutes = null;

    if (assignedAt && pickedUpAt) pickupMinutes = Math.round((pickedUpAt - assignedAt) / 60000);
    if (pickedUpAt && deliveredAt) deliveryMinutes = Math.round((deliveredAt - pickedUpAt) / 60000);
    if (assignedAt && deliveredAt) totalMinutes = Math.round((deliveredAt - assignedAt) / 60000);

    return {
      ...d,
      pickupMinutes,
      deliveryMinutes,
      totalMinutes,
      hasIncident: d.incidents.length > 0,
    };
  });

  return NextResponse.json({ items: serialize(deliveriesWithDetails), total, limit, offset });
}