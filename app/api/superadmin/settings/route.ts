import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeSuperAdmin } from "@/lib/auth";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const input = z.object({ name: z.string().trim().min(2).max(120), logoUrl: z.string().trim().max(500).optional(), isotypeUrl: z.string().trim().max(500).optional(), faviconUrl: z.string().trim().max(500).optional() });

export async function PATCH(request: Request) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá la identidad de MenuClick" }, { status: 400 });
  const current = await prisma.platformSettings.findUnique({ where: { id: 1 } });
  const settings = await prisma.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: { ...parsed.data, logoUrl: parsed.data.logoUrl || null, isotypeUrl: parsed.data.isotypeUrl || null, faviconUrl: parsed.data.faviconUrl || null } });
  await recordAudit({ context: auth, action: "platform-settings-updated", entityType: "platform-settings", entityId: 1, oldValues: current ? toAuditValue(current) : undefined, newValues: toAuditValue(settings), request });
  return NextResponse.json({ settings: toAuditValue(settings) });
}
