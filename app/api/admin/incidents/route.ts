import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const incidentListInput = z.object({
  q: z.string().trim().optional(),
  type: z.string().optional(),
  driverId: z.coerce.number().int().positive().optional(),
  deliveryId: z.coerce.number().int().positive().optional(),
  resolved: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * @summary Lista incidencias de repartidores con filtros y paginación.
 */
export async function GET(request: Request) {
  const auth = await authorize("incident.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = incidentListInput.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });

  const { q, type, driverId, deliveryId, resolved, limit, offset } = parsed.data;

  const where: Record<string, unknown> = { tenantId: auth.tenant.id };

  if (type) where.type = type;
  if (resolved !== undefined) where.resolved = resolved;
  if (driverId) {
    // Check if the driver belongs to an accessible branch? We'll check via the driver's branches.
    // For simplicity, we'll just check the driver exists and is in the tenant.
    const driver = await prisma.driverProfile.findFirst({
      where: { id: driverId, tenantId: auth.tenant.id },
      select: { id: true },
    });
    if (!driver) {
      return NextResponse.json({ error: "Chofer no encontrado" }, { status: 404 });
    }
    where.driverId = driverId;
  }
  if (deliveryId) {
    const delivery = await prisma.orderDelivery.findFirst({
      where: { id: deliveryId, tenantId: auth.tenant.id },
      select: { id: true },
    });
    if (!delivery) {
      return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
    }
    where.deliveryId = deliveryId;
  }

  if (q) {
    where.OR = [
      { type: { contains: q } },
      { description: { contains: q } },
      { delivery: { customerName: { contains: q } } },
      { reportedBy: { name: { contains: q } } },
    ];
  }

  const [incidents, total] = await Promise.all([
    prisma.driverIncident.findMany({
      where,
      include: {
        driver: { select: { id: true, name: true } },
        delivery: { select: { id: true, number: true, customerName: true } },
        reportedBy: { select: { id: true, name: true } },
      },
      orderBy: { reportedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.driverIncident.count({ where }),
  ]);

  return NextResponse.json({ items: serialize(incidents), total, limit, offset });
}

const createIncidentInput = z.object({
  driverId: z.number().int().positive(),
  deliveryId: z.number().int().positive().optional(),
  type: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1),
  reportedById: z.number().int().positive().optional(),
});

/**
 * @summary Crea una nueva incidencia reportada durante una entrega.
 */
export async function POST(request: Request) {
  const auth = await authorize("incident.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createIncidentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { driverId, deliveryId, type, description, reportedById } = parsed.data;

  // Validate driverId
  const driver = await prisma.driverProfile.findFirst({
    where: { id: driverId, tenantId: auth.tenant.id },
    select: { id: true },
  });
  if (!driver) {
    return NextResponse.json({ error: "Chofer no encontrado" }, { status: 404 });
  }

  // Validate deliveryId if provided
  if (deliveryId) {
    const delivery = await prisma.orderDelivery.findFirst({
      where: { id: deliveryId, tenantId: auth.tenant.id },
      select: { id: true },
    });
    if (!delivery) {
      return NextResponse.json({ error: "Entrega no encontrada" }, { status: 404 });
    }
  }

  // Validate reportedById if provided
  const reporterId = reportedById ?? auth.session.userId;
  if (reporterId) {
    const user = await prisma.user.findFirst({
      where: { id: reporterId, memberships: { some: { tenantId: auth.tenant.id, status: "active" } } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado o sin membresía activa" }, { status: 404 });
    }
  }

  try {
    const incident = await prisma.driverIncident.create({
      data: {
        tenantId: auth.tenant.id,
        driverId,
        deliveryId: deliveryId ?? null,
        type,
        description,
        reportedById: reporterId,
      },
    });

    await recordAudit({
      context: auth,
      action: "incident-create",
      entityType: "driver-incident",
      entityId: incident.id,
      newValues: toAuditValue(incident),
      request,
    });

    return NextResponse.json({ incident: serialize(incident) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la incidencia" },
      { status: 500 }
    );
  }
}