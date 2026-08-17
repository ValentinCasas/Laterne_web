import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listPayablePayments, createPayablePayment } from "@/lib/finance";

const listSchema = z.object({
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const createSchema = z.object({
  invoiceId: z.coerce.number().int().positive().optional().nullable(),
  expenseId: z.coerce.number().int().positive().optional().nullable(),
  amount: z.coerce.number().positive(),
  method: z.string().trim().min(1).max(40),
  paidAt: z.string().optional().nullable(),
  notes: z.string().trim().max(240).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    supplierId: url.searchParams.get("supplierId"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    branchId: url.searchParams.get("branchId"),
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const data = await listPayablePayments(auth.tenant.id, parsed.data);
  return NextResponse.json(serialize(data));
}

export async function POST(request: Request) {
  const auth = await authorize("finance.payment");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const payment = await createPayablePayment(auth.tenant.id, auth.session.userId, parsed.data);
    await recordAudit({
      context: auth,
      action: "payable-payment-create",
      entityType: "purchase-payment",
      entityId: payment.id,
      newValues: toAuditValue(serialize(payment)),
      request,
    });
    return NextResponse.json({ payment: serialize(payment) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo registrar el pago" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
