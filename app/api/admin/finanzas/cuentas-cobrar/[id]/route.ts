import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { getReceivableDocument, updateReceivableDocument } from "@/lib/finance";

const updateSchema = z.object({
  status: z.string().trim().min(1).max(20).optional(),
  notes: z.string().trim().max(300).optional().nullable(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Documento inválido" }, { status: 400 });

  try {
    const document = await getReceivableDocument(auth.tenant.id, id);
    return NextResponse.json({ document: serialize(document) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo obtener el documento" },
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
    const document = await updateReceivableDocument(auth.tenant.id, id, parsed.data);
    await recordAudit({
      context: auth,
      action: "receivable-document-update",
      entityType: "receivable-document",
      entityId: id,
      newValues: toAuditValue(serialize(document)),
      request,
    });
    return NextResponse.json({ document: serialize(document) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el documento" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
