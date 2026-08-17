import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { getCashFlow } from "@/lib/finance";

const schema = z.object({
  dateFrom: z.string().min(1),
  dateTo: z.string().min(1),
  branchId: z.coerce.number().int().positive().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    dateFrom: url.searchParams.get("dateFrom"),
    dateTo: url.searchParams.get("dateTo"),
    branchId: url.searchParams.get("branchId"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const data = await getCashFlow(auth.tenant.id, parsed.data);
  return NextResponse.json(serialize(data));
}
