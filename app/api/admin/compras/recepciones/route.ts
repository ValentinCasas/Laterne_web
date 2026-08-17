import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listPurchaseReceipts } from "@/lib/purchases";

/** @summary Lista recepciones físicas con filtros. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const url = new URL(request.url);
  const result = await listPurchaseReceipts(auth.tenant.id, {
    branchId: url.searchParams.get("branchId") ? Number(url.searchParams.get("branchId")) : null,
    supplierId: url.searchParams.get("supplierId") ? Number(url.searchParams.get("supplierId")) : null,
    orderId: url.searchParams.get("orderId") ? Number(url.searchParams.get("orderId")) : null,
    query: url.searchParams.get("q") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    limit: Number(url.searchParams.get("limit") ?? 60),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return NextResponse.json(serialize(result));
}
