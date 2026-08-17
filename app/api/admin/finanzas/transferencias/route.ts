import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listTransfers, createTransfer } from "@/lib/finance";

const listSchema = z.object({
  branchId: z.coerce.number().int().positive().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const createSchema = z.object({
  fromAccountId: z.coerce.number().int().positive(),
  toAccountId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  transferDate: z.string().optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    branchId: url.searchParams.get("branchId"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const data = await listTransfers(auth.tenant.id, parsed.data);
  return NextResponse.json(serialize(data));
}

export async function POST(request: Request) {
  const auth = await authorize("finance.transfer");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const transfer = await createTransfer(auth.tenant.id, auth.session.userId, parsed.data);
    await recordAudit({
      context: auth,
      action: "transfer-create",
      entityType: "financial-transfer",
      entityId: transfer.id,
      newValues: toAuditValue(serialize(transfer)),
      request,
    });
    return NextResponse.json({ transfer: serialize(transfer) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la transferencia" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
