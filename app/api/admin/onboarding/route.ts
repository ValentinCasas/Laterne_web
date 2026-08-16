import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * @summary Valida la entrada relacionada con el onboarding.
 */
const progressInput = z.object({
  completedSteps: z.array(z.number().int().min(1).max(10)).max(10),
  currentStep: z.number().int().min(1).max(10),
  publish: z.boolean().optional(),
});

/** @summary Guarda el progreso del asistente y permite reanudarlo desde cualquier dispositivo. */
export async function PATCH(request: Request) {
  const auth = await authorize("admin.access");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = progressInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Progreso inválido" }, { status: 400 });
  const completedSteps = [...new Set(parsed.data.completedSteps)].sort((left, right) => left - right);
  const current = await prisma.onboardingProgress.findUnique({ where: { tenantId: auth.tenant.id } });
  const progress = await prisma.onboardingProgress.upsert({
    where: { tenantId: auth.tenant.id },
    create: {
      tenantId: auth.tenant.id,
      completedSteps,
      currentStep: parsed.data.currentStep,
      percentage: completedSteps.length * 10,
      publishedAt: parsed.data.publish ? new Date() : null,
    },
    update: {
      completedSteps,
      currentStep: parsed.data.currentStep,
      percentage: completedSteps.length * 10,
      ...(parsed.data.publish ? { publishedAt: new Date() } : {}),
    },
  });
  await recordAudit({
    context: auth,
    action: parsed.data.publish ? "publish" : "update",
    entityType: "onboarding",
    entityId: progress.id,
    oldValues: current ? toAuditValue(serialize(current)) : undefined,
    newValues: toAuditValue(serialize(progress)),
    request,
  });
  return NextResponse.json({ progress: serialize(progress) });
}
