import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/format";
import { listLatestDriverPositions } from "@/lib/delivery-positions";
import { haversineMeters } from "@/lib/geofence";

const positionInput = z
  .object({
    deliveryId: z.coerce.number().int().positive().optional(),
    branchId: z.coerce.number().int().positive().optional(),
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    accuracy: z.coerce.number().min(0).max(10_000).optional(),
    recordedAt: z.coerce.date().optional(),
  })
  .refine((value) => Boolean(value.deliveryId) !== Boolean(value.branchId), {
    message: "Indicá una entrega o una sucursal, pero no ambas",
  });

/** @summary Lista la última posición visible de cada repartidor para el centro de delivery. */
export async function GET(request: Request) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const branchParam = new URL(request.url).searchParams.get("branchId");
  const branchId = branchParam ? Number(branchParam) : null;
  const accessibleBranchIds = auth.branches.map((branch) => branch.id);
  if (branchId && (!Number.isInteger(branchId) || !accessibleBranchIds.includes(branchId))) {
    return NextResponse.json({ error: "Sucursal no autorizada" }, { status: 403 });
  }

  const items = await listLatestDriverPositions(auth.tenant.id, accessibleBranchIds, branchId);
  return NextResponse.json({ items: serialize(items) });
}

/**
 * @summary Recibe una posición GPS del repartidor. Solo se guarda si el repartidor
 * está asignado a una entrega activa o si la sucursal coincide con su acceso.
 * La posición queda disponible para el seguimiento del centro de delivery.
 */
export async function POST(request: Request) {
  const auth = await authorize();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const driverProfile = await prisma.driverProfile.findFirst({
    where: { tenantId: auth.tenant.id, userId: auth.session.userId, active: true },
    select: { id: true },
  });
  if (!driverProfile) return NextResponse.json({ error: "No tenés un perfil de repartidor activo vinculado" }, { status: 403 });

  const parsed = positionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos de posición inválidos" }, { status: 400 });

  const { deliveryId, branchId, latitude, longitude, accuracy } = parsed.data;
  let resolvedBranchId: number | null = null;

  if (deliveryId) {
    const delivery = await prisma.orderDelivery.findFirst({
      where: {
        id: deliveryId,
        tenantId: auth.tenant.id,
        driverProfileId: driverProfile.id,
        status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] },
      },
      select: { branchId: true },
    });
    if (!delivery) return NextResponse.json({ error: "La entrega no está activa o no está asignada a vos" }, { status: 403 });
    resolvedBranchId = delivery.branchId;
  } else if (branchId) {
    const branchAccess = await prisma.driverBranch.findFirst({
      where: { driverId: driverProfile.id, tenantId: auth.tenant.id, branchId, branch: { active: true } },
      select: { branchId: true },
    });
    if (!branchAccess) {
      return NextResponse.json({ error: "No tenés acceso a la sucursal" }, { status: 403 });
    }
    resolvedBranchId = branchAccess.branchId;
  } else {
    return NextResponse.json({ error: "Indicá la entrega o la sucursal" }, { status: 400 });
  }

  const now = new Date();
  const reportedAt = parsed.data.recordedAt;
  const recordedAt =
    reportedAt && reportedAt.getTime() >= now.getTime() - 120_000 && reportedAt.getTime() <= now.getTime() + 30_000
      ? reportedAt
      : now;
  const latest = await prisma.driverPosition.findFirst({
    where: { tenantId: auth.tenant.id, driverProfileId: driverProfile.id },
    orderBy: { recordedAt: "desc" },
  });
  const elapsed = latest ? Math.max(0, recordedAt.getTime() - latest.recordedAt.getTime()) : Number.POSITIVE_INFINITY;
  const distance = latest
    ? haversineMeters(Number(latest.latitude), Number(latest.longitude), latitude, longitude)
    : Number.POSITIVE_INFINITY;

  // Defensa adicional al throttle del cliente: evita ráfagas y escrituras sin movimiento útil.
  if (elapsed < 5_000 || (elapsed < 30_000 && distance < 5)) {
    return NextResponse.json({ ok: true, throttled: true, recordedAt: latest?.recordedAt ?? recordedAt }, { status: 202 });
  }

  const data = {
    tenantId: auth.tenant.id,
    branchId: resolvedBranchId,
    deliveryId: deliveryId ?? null,
    driverId: auth.session.userId,
    driverProfileId: driverProfile.id,
    latitude: String(latitude),
    longitude: String(longitude),
    accuracy: accuracy === undefined ? null : String(accuracy),
    recordedAt,
  };
  const sameScope =
    latest && latest.branchId === resolvedBranchId && latest.deliveryId === (deliveryId ?? null) && elapsed < 5 * 60_000;
  const position = sameScope
    ? await prisma.driverPosition.update({ where: { id: latest.id }, data })
    : await prisma.driverPosition.create({ data });

  return NextResponse.json(
    { ok: true, throttled: false, position: serialize({ id: position.id, recordedAt: position.recordedAt }) },
    { status: sameScope ? 200 : 201 },
  );
}
