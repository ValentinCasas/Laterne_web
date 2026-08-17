import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const incidentListInput = z.object({
  status: z.enum(["all", "open", "resolved"]).default("all"),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * @summary Lista incidencias de un repartidor.
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
  const parsed = incidentListInput.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  const { status, limit, offset } = parsed.data;

  const where: Record<string, unknown> = { tenantId: auth.tenant.id, driverId };
  if (status === "open") where.resolved = false;
  if (status === "resolved") where.resolved = true;

  const [incidents, total] = await Promise.all([
    prisma.driverIncident.findMany({
      where,
      include: { delivery: { select: { id: true, number: true, customerName: true } }, reportedBy: { select: { id: true, name: true } } },
      orderBy: { reportedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.driverIncident.count({ where }),
  ]);

  return NextResponse.json({ items: serialize(incidents), total, limit, offset });
}

const createIncidentInput = z.object({
  deliveryId: z.coerce.number().int().positive().optional(),
  type: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(2000),
});

/**
 * @summary Registra una incidencia para un repartidor.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("incident.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverId = Number((await context.params).id);
  if (!Number.isInteger(driverId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const driver = await prisma.driverProfile.findFirst({ where: { id: driverId, tenantId: auth.tenant.id }, include: { branches: true } });
  if (!driver) return NextResponse.json({ error: "Repartidor no encontrado" }, { status: 404 });

  const accessibleBranchIds = auth.branches.map((b) => b.id);
  const driverBranchIds = driver.branches.map((db) => db.branchId);
  const hasAccess = auth.allBranches || driverBranchIds.some((bid) => accessibleBranchIds.includes(bid));
  if (!hasAccess) return NextResponse.json({ error: "No tenés acceso a este repartidor" }, { status: 403 });

  const parsed = createIncidentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { deliveryId, type, description } = parsed.data;

  if (deliveryId) {
    const delivery = await prisma.orderDelivery.findFirst({
      where: { id: deliveryId, tenantId: auth.tenant.id },
      include: { order: { select: { branchId: true } } },
    });
    if (!delivery) return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
    if (delivery.driverProfileId !== driverId) {
      return NextResponse.json({ error: "La entrega no pertenece a este repartidor" }, { status: 400 });
    }
    if (delivery.order.branchId && !canAccessBranch(auth, delivery.order.branchId)) {
      return NextResponse.json({ error: "No tenés acceso a la sucursal de la entrega" }, { status: 403 });
    }
  }

  const incident = await prisma.driverIncident.create({
    data: {
      tenantId: auth.tenant.id,
      driverId,
      deliveryId: deliveryId ?? null,
      type,
      description,
      reportedById: auth.session.userId,
    },
    include: { delivery: { select: { id: true, number: true, customerName: true } }, reportedBy: { select: { id: true, name: true } } },
  });

  await recordAudit({
    context: auth,
    action: "driver-incident-create",
    entityType: "driver-incident",
    entityId: incident.id,
    newValues: toAuditValue(incident),
    request,
  });

  return NextResponse.json({ incident: serialize(incident) }, { status: 201 });
}