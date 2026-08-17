import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { getProfitLoss } from "@/lib/finance";

const schema = z.object({
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const raw = Object.fromEntries(
    Object.entries({
      dateFrom: url.searchParams.get("dateFrom"),
      dateTo: url.searchParams.get("dateTo"),
      branchId: url.searchParams.get("branchId"),
    }).filter(([, value]) => value !== null),
  ) as { dateFrom?: string; dateTo?: string; branchId?: number };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const cleaned = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== null),
  ) as Parameters<typeof getProfitLoss>[1];
  const data = await getProfitLoss(auth.tenant.id, cleaned);
  return NextResponse.json(serialize(data));
}
