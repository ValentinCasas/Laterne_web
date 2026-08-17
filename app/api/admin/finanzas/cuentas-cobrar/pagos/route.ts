import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listReceivablePayments, createReceivablePayment } from "@/lib/finance";

const listSchema = z.object({
  customerId: z.coerce.number().int().positive().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const createSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  method: z.string().trim().min(1).max(40),
  accountId: z.coerce.number().int().positive().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().trim().max(240).optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  allocations: z.array(
    z.object({
      documentId: z.coerce.number().int().positive(),
      amount: z.coerce.number().positive(),
    }),
  ),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    customerId: url.searchParams.get("customerId"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    branchId: url.searchParams.get("branchId"),
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const data = await listReceivablePayments(auth.tenant.id, parsed.data);
  return NextResponse.json(serialize(data));
}

export async function POST(request: Request) {
  const auth = await authorize("finance.payment");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const payment = await createReceivablePayment(auth.tenant.id, auth.session.userId, parsed.data);
    await recordAudit({
      context: auth,
      action: "receivable-payment-create",
      entityType: "receivable-payment",
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
