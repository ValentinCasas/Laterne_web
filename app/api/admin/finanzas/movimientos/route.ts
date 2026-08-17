import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listFinancialMovements, createFinancialMovement } from "@/lib/finance";

const listSchema = z.object({
  accountId: z.coerce.number().int().positive().optional().nullable(),
  type: z.string().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  q: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const createSchema = z.object({
  accountId: z.coerce.number().int().positive(),
  type: z.string().trim().min(1).max(30),
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive(),
  concept: z.string().trim().min(1).max(220),
  date: z.string().optional().nullable(),
  reference: z.string().trim().max(80).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    accountId: url.searchParams.get("accountId"),
    type: url.searchParams.get("type"),
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    branchId: url.searchParams.get("branchId"),
    q: url.searchParams.get("q"),
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const cleaned = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== null),
  ) as Parameters<typeof listFinancialMovements>[1];
  const data = await listFinancialMovements(auth.tenant.id, cleaned);
  return NextResponse.json(serialize(data));
}

export async function POST(request: Request) {
  const auth = await authorize("finance.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const movement = await createFinancialMovement(auth.tenant.id, auth.session.userId, parsed.data);
    await recordAudit({
      context: auth,
      action: "movement-create",
      entityType: "financial-movement",
      entityId: movement.id,
      newValues: toAuditValue(serialize(movement)),
      request,
    });
    return NextResponse.json({ movement: serialize(movement) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el movimiento" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
