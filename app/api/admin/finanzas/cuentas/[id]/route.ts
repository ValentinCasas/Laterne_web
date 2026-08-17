import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { getAccountWithBalance, updateFinancialAccount, deleteFinancialAccount } from "@/lib/finance";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  code: z.string().trim().max(40).optional().nullable(),
  type: z.string().trim().min(1).max(30).optional(),
  status: z.string().trim().min(1).max(20).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Cuenta inválida" }, { status: 400 });

  try {
    const account = await getAccountWithBalance(auth.tenant.id, id);
    return NextResponse.json({ account: serialize(account) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo obtener la cuenta" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 404 : 404 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("finance.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = Number((await context.params).id);
  const body = await request.json().catch(() => null);
  if (!Number.isInteger(id) || !body) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const account = await updateFinancialAccount(id, auth.tenant.id, parsed.data);
    await recordAudit({
      context: auth,
      action: "account-update",
      entityType: "financial-account",
      entityId: id,
      newValues: toAuditValue(serialize(account)),
      request,
    });
    return NextResponse.json({ account: serialize(account) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la cuenta" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("finance.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Cuenta inválida" }, { status: 400 });

  try {
    await deleteFinancialAccount(auth.tenant.id, id);
    await recordAudit({
      context: auth,
      action: "account-delete",
      entityType: "financial-account",
      entityId: id,
      request: _request,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar la cuenta" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
