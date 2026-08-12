import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const notificationUpdate = z
  .object({ id: z.coerce.bigint().positive().optional(), all: z.boolean().optional() })
  .refine((value) => value.id || value.all);

/** @summary Devuelve avisos recientes y cantidad pendiente para el centro de actividad. */
export async function GET() {
  const auth = await authorize("notification.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const scope =
    auth.activeBranchId && auth.activeBranchId > 0
      ? { OR: [{ branchId: auth.activeBranchId }, { branchId: null }] }
      : {};
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { tenantId: auth.tenant.id, ...scope },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.notification.count({ where: { tenantId: auth.tenant.id, ...scope, readAt: null } }),
  ]);
  return NextResponse.json({ notifications: serialize(notifications), unread });
}

/** @summary Marca uno o todos los avisos como leídos sin modificar notificaciones ajenas. */
export async function PATCH(request: Request) {
  const auth = await authorize("notification.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = notificationUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  const scope =
    auth.activeBranchId && auth.activeBranchId > 0
      ? { OR: [{ branchId: auth.activeBranchId }, { branchId: null }] }
      : {};
  await prisma.notification.updateMany({
    where: {
      tenantId: auth.tenant.id,
      ...scope,
      ...(parsed.data.all ? { readAt: null } : { id: parsed.data.id }),
    },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
