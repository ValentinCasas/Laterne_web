import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { listSupplierLedger } from "@/lib/purchases";

/** @summary Ledger de un proveedor. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const url = new URL(request.url);
  const result = await listSupplierLedger(auth.tenant.id, Number(id), {
    type: url.searchParams.get("type") || undefined,
    status: url.searchParams.get("status") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    limit: Number(url.searchParams.get("limit") ?? 100),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return NextResponse.json(serialize(result));
}
