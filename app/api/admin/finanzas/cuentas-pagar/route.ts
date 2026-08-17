import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listPayables, getPayablesAging } from "@/lib/finance";

const listSchema = z.object({
  supplierId: z.coerce.number().int().positive().optional().nullable(),
  status: z.string().optional().nullable(),
  dateFrom: z.string().optional().nullable(),
  dateTo: z.string().optional().nullable(),
  branchId: z.coerce.number().int().positive().optional().nullable(),
  q: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).default(60),
  offset: z.coerce.number().int().nonnegative().default(0),
  aging: z.coerce.number().int().positive().optional().nullable(),
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
    aging: url.searchParams.get("aging"),
  });

  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const { aging, ...rest } = parsed.data;
  const cleaned = (Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== null),
  ) as Parameters<typeof listPayables>[1]) ?? {};
  const data = await listPayables(auth.tenant.id, cleaned);
  const response: Record<string, unknown> = serialize(data);
  if (aging) {
    response.aging = serialize(await getPayablesAging(auth.tenant.id, cleaned.branchId ?? null));
  }
  return NextResponse.json(response);
}
