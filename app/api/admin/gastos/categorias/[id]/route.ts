import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { updateExpenseCategory } from "@/lib/expenses";

/** @summary Detalle de una categoría de gasto. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const category = await prisma.expenseCategory.findFirst({
    where: { id: Number(id), tenantId: auth.tenant.id },
  });
  if (!category) return NextResponse.json({ error: "La categoría no existe" }, { status: 404 });
  return NextResponse.json(serialize(category));
}

/** @summary Actualiza una categoría de gasto (nombre, grupo o activo). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Revisá los datos de la categoría" }, { status: 400 });
  }

  try {
    const updated = await updateExpenseCategory(auth.tenant.id, Number(id), {
      group: parsed.group,
      name: parsed.name,
      active: parsed.active,
    });
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "expense-category",
      entityId: Number(id),
      newValues: toAuditValue(serialize(updated)),
      request,
    });
    return NextResponse.json({ item: serialize(updated) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la categoría" },
      { status: 400 },
    );
  }
}

/** @summary Elimina una categoría de gasto. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const deleted = await prisma.expenseCategory.deleteMany({
      where: { id: Number(id), tenantId: auth.tenant.id },
    });
    if (!deleted.count) return NextResponse.json({ error: "La categoría no existe" }, { status: 404 });
    await recordAudit({
      context: auth,
      action: "delete",
      entityType: "expense-category",
      entityId: Number(id),
      newValues: { deleted: true },
      request,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la categoría" },
      { status: 409 },
    );
  }
}
