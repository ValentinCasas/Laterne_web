import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listPayables } from "@/lib/finance";

const listSchema = z.object({
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  status: z.string().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  q: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export async function GET(request: Request) {
  const auth = await authorize("finance.view");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const parsed = listSchema.safeParse({
    supplierId: url.searchParams.get("supplierId"),
    status: url.searchParams.get("status"),
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
  ) as Parameters<typeof listPayables>[1];
  const data = await listPayables(auth.tenant.id, cleaned);
  return NextResponse.json(serialize(data));
}
