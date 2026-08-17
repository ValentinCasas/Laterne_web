import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { getSupplierStatement } from "@/lib/purchases";

/** @summary Estado de cuenta resumido del proveedor. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const statement = await getSupplierStatement(auth.tenant.id, Number(id));
    return NextResponse.json(serialize(statement));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el estado de cuenta" },
      { status: 404 },
    );
  }
}
