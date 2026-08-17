import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listFinancialAccounts, createFinancialAccount } from "@/lib/finance";

const listSchema = z.object({
  branchId: z.coerce.number().int().positive().optional().nullable(),
  type: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  q: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().max(40).optional().nullable(),
  type: z.string().trim().min(1).max(30),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  currency: z.string().trim().max(3).optional().nullable(),
  openingBalance: z.coerce.number().min(0).default(0),
  openingDate: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    branchId: url.searchParams.get("branchId"),
    type: url.searchParams.get("type"),
    status: url.searchParams.get("status"),
    q: url.searchParams.get("q"),
    limit: url.searchParams.get("limit"),
    offset: url.searchParams.get("offset"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const data = await listFinancialAccounts(auth.tenant.id, parsed.data);
  return NextResponse.json(serialize(data));
}

export async function POST(request: Request) {
  const auth = await authorize("finance.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const account = await createFinancialAccount(auth.tenant.id, parsed.data);
    await recordAudit({
      context: auth,
      action: "account-create",
      entityType: "financial-account",
      entityId: account.id,
      newValues: toAuditValue(serialize(account)),
      request,
    });
    return NextResponse.json({ account: serialize(account) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la cuenta" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
