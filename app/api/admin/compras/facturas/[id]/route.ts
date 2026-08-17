import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { annulPurchaseInvoice, loadPurchaseInvoice, updatePurchaseInvoice } from "@/lib/purchases";

/** @summary Detalle de una factura con pagos, recepciones e historial. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const invoice = await loadPurchaseInvoice(auth.tenant.id, Number(id));
    return NextResponse.json(serialize(invoice));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar la factura" },
      { status: 404 },
    );
  }
}

/** @summary Edita datos de una factura sin pagos. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = z
    .object({
      documentDate: z.string().optional(),
      dueDate: z.string().nullable().optional(),
      externalNumber: z.string().trim().max(120).optional(),
      financialCategory: z.string().trim().max(80).optional(),
      notes: z.string().trim().max(2000).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la factura" }, { status: 400 });

  try {
    const invoice = await updatePurchaseInvoice(auth.tenant.id, Number(id), parsed.data);
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "purchase-invoice",
      entityId: invoice.id,
      newValues: toAuditValue(serialize(invoice)),
      request,
    });
    return NextResponse.json({ item: serialize(invoice) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar la factura" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}

/** @summary Anula una factura (solo sin pagos registrados). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = z.object({ status: z.literal("cancelled") }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Acción no válida" }, { status: 400 });

  try {
    const invoice = await annulPurchaseInvoice(auth.tenant.id, Number(id));
    await recordAudit({
      context: auth,
      action: "annul",
      entityType: "purchase-invoice",
      entityId: invoice.id,
      newValues: { status: "cancelled" },
      request,
    });
    return NextResponse.json({ item: serialize(invoice) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo anular la factura" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
