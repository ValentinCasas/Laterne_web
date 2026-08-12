import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateInput = z.object({
  status: z.enum(["draft", "issued", "cancelled"]),
  customerTaxId: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** @summary Cambia el estado del comprobante interno y conserva el cambio en la auditoría administrativa. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = updateInput.safeParse(await request.json().catch(() => null));
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Comprobante inválido" }, { status: 400 });
  }
  const previous = await prisma.invoiceRecord.findFirst({ where: { id, tenantId: auth.tenant.id, ...(auth.activeBranchId && auth.activeBranchId > 0 ? { branchId: auth.activeBranchId } : {}) } });
  if (!previous) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  const invoice = await prisma.invoiceRecord.update({
    where: { id },
    data: {
      status: parsed.data.status,
      customerTaxId: parsed.data.customerTaxId || null,
      notes: parsed.data.notes || null,
      issuedAt: parsed.data.status === "issued" ? (previous.issuedAt ?? new Date()) : previous.issuedAt,
    },
    include: { order: true, branch: true },
  });
  await recordAudit({
    context: auth,
    action: "invoice.update",
    entityType: "invoice",
    entityId: id,
    oldValues: toAuditValue(previous),
    newValues: toAuditValue(invoice),
    request,
  });
  return NextResponse.json({ invoice });
}
