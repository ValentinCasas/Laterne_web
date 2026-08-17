import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("incident.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const paramsObj = await params;
  const incidentId = parseInt(paramsObj.id, 10);
  if (isNaN(incidentId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const incident = await prisma.driverIncident.findUnique({
    where: { id: incidentId, tenantId: auth.tenant.id },
    include: {
      driver: { select: { id: true, name: true } },
      delivery: { select: { id: true, number: true, customerName: true } },
      reportedBy: { select: { id: true, name: true } },
    },
  });

  if (!incident) {
    return NextResponse.json({ error: "Incidencia no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ incident: serialize(incident) });
}

const updateIncidentInput = z.object({
  type: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).optional(),
  reportedById: z.number().int().positive().optional(),
  resolved: z.boolean().optional(),
  resolution: z.string().trim().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("incident.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const paramsObj = await params;
  const incidentId = parseInt(paramsObj.id, 10);
  if (isNaN(incidentId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const parsed = updateIncidentInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { type, description, reportedById, resolved, resolution } = parsed.data;

  // Validate reportedById if provided
  if (reportedById !== undefined && reportedById !== null) {
    const user = await prisma.user.findFirst({
      where: { id: reportedById, memberships: { some: { tenantId: auth.tenant.id, status: "active" } } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado o sin membresía activa" }, { status: 404 });
    }
  }

  try {
    const incident = await prisma.$transaction(async (tx) => {
      const updated = await tx.driverIncident.update({
        where: { id: incidentId, tenantId: auth.tenant.id },
        data: {
          type,
          description,
          reportedById: reportedById ?? null,
          resolved,
          resolution: resolution ?? null,
          resolvedAt: resolved ? new Date() : null,
        },
      });

      return updated;
    });

    await recordAudit({
      context: auth,
      action: "incident-update",
      entityType: "driver-incident",
      entityId: incident.id,
      oldValues: toAuditValue({ ...incident, ...parsed.data }), // Approximation
      newValues: toAuditValue(incident),
      request,
    });

    return NextResponse.json({ incident: serialize(incident) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la incidencia" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorize("incident.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const paramsObj = await params;
  const incidentId = parseInt(paramsObj.id, 10);
  if (isNaN(incidentId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    await prisma.driverIncident.delete({
      where: { id: incidentId, tenantId: auth.tenant.id },
    });

    await recordAudit({
      context: auth,
      action: "incident-delete",
      entityType: "driver-incident",
      entityId: incidentId,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la incidencia" },
      { status: 500 }
    );
  }
}