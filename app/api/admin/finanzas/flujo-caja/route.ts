import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { getCashFlow } from "@/lib/finance";

const schema = z.object({
  period: z.enum(["day", "week", "month", "custom"]).default("month"),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  from: z.string().optional().nullable(),
  to: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    period: url.searchParams.get("period") || undefined,
    branchId: url.searchParams.get("branchId"),
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const cleaned = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== null),
  ) as Parameters<typeof getCashFlow>[1];
  const data = await getCashFlow(auth.tenant.id, cleaned);
  return NextResponse.json(serialize(data));
}
