import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";

const updateAvailabilityInput = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
});

/**
 * @summary Permite al repartidor actualizar su disponibilidad.
 */
export async function PATCH(request: Request) {
  const auth = await authorize("driver.self");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId },
  });

  if (!driverProfile) {
    return NextResponse.json({ error: "No tenés un perfil de repartidor vinculado" }, { status: 403 });
  }

  if (!driverProfile.active) {
    return NextResponse.json({ error: "Tu perfil está inactivo. Contactá a un administrador." }, { status: 403 });
  }

  const parsed = updateAvailabilityInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });

  const { status } = parsed.data;

  const oldValues = toAuditValue({ ...driverProfile, status: driverProfile.status });

  const updated = await prisma.driverProfile.update({
    where: { id: driverProfile.id },
    data: { status },
  });

  await recordAudit({
    context: auth,
    action: "driver-availability-update",
    entityType: "driver-profile",
    entityId: driverProfile.id,
    oldValues,
    newValues: toAuditValue({ ...updated, status: updated.status }),
    request,
  });

  return NextResponse.json({ driver: serialize(updated) });
}

/**
 * @summary Obtiene el perfil del repartidor autenticado.
 */
export async function GET() {
  const auth = await authorize("driver.self");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId },
    include: { branches: { include: { branch: { select: { id: true, name: true, slug: true } } } } },
  });

  if (!driverProfile) {
    return NextResponse.json({ error: "No tenés un perfil de repartidor vinculado" }, { status: 403 });
  }

  return NextResponse.json({ driver: serialize(driverProfile) });
}