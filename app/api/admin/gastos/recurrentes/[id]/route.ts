import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { updateRecurringExpense, removeRecurringExpense } from "@/lib/expenses";

/** @summary Detalle de un gasto recurrente. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const item = await prisma.recurringExpense.findFirst({
    where: { id: Number(id), tenantId: auth.tenant.id },
    include: { category: { select: { id: true, name: true, group: true } } },
  });
  if (!item) return NextResponse.json({ error: "La previsión no existe" }, { status: 404 });
  return NextResponse.json(serialize(item));
}

/** @summary Actualiza un gasto recurrente. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Revisá los datos de la previsión" }, { status: 400 });
  }

  try {
    const updated = await updateRecurringExpense(auth.tenant.id, Number(id), {
      active: parsed.active,
      name: parsed.name,
      amount: parsed.amount,
    });
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "recurring-expense",
      entityId: Number(id),
      newValues: toAuditValue(serialize(updated)),
      request,
    });
    return NextResponse.json({ item: serialize(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la previsión" },
      { status: 400 },
    );
  }
}

/** @summary Elimina un gasto recurrente. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const result = await removeRecurringExpense(auth.tenant.id, Number(id));
    await recordAudit({
      context: auth,
      action: "delete",
      entityType: "recurring-expense",
      entityId: Number(id),
      newValues: { deleted: true },
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la previsión" },
      { status: 409 },
    );
  }
}
