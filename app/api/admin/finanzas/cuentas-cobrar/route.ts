import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listReceivables, createReceivableDocument, getReceivablesAging } from "@/lib/finance";

const listSchema = z.object({
  customerId: z.coerce.number().int().positive().optional().nullable(),
  status: z.string().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  q: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
  aging: z.coerce.number().int().positive().optional().nullable(),
});

const createSchema = z.object({
  customerId: z.coerce.number().int().positive(),
  orderId: z.coerce.number().int().positive().optional().nullable(),
  number: z.string().trim().max(24).optional().nullable(),
  dueDate: z.string().min(1),
  originalAmount: z.coerce.number().min(0),
  concept: z.string().trim().min(1).max(300),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(300).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    customerId: url.searchParams.get("customerId"),
    status: url.searchParams.get("status"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    branchId: url.searchParams.get("branchId"),
    q: url.searchParams.get("q"),
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
    aging: url.searchParams.get("aging"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { aging, ...rest } = parsed.data;
  const cleaned = (Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== null),
  ) as Parameters<typeof listReceivables>[1]) ?? {};
  const data = await listReceivables(auth.tenant.id, cleaned);
  const response: Record<string, unknown> = serialize(data);
  if (aging) {
    response.aging = serialize(await getReceivablesAging(auth.tenant.id, cleaned.branchId ?? null));
  }
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const auth = await authorize("finance.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const document = await createReceivableDocument(auth.tenant.id, auth.session.userId, parsed.data);
    await recordAudit({
      context: auth,
      action: "receivable-document-create",
      entityType: "receivable-document",
      entityId: document.id,
      newValues: toAuditValue(serialize(document)),
      request,
    });
    return NextResponse.json({ document: serialize(document) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el documento" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
