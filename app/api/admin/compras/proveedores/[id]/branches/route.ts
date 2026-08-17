import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { setSupplierBranches } from "@/lib/purchases";

/** @summary Reemplaza las sucursales habilitadas de un proveedor. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = await request.json().catch(() => null);
  if (!parsed || !Array.isArray(parsed.branchIds)) {
    return NextResponse.json({ error: "Revisá las sucursales" }, { status: 400 });
  }

  try {
    const supplier = await setSupplierBranches(auth.tenant.id, Number(id), parsed.branchIds.map(Number));
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "supplier-branches",
      entityId: Number(id),
      newValues: toAuditValue(serialize(supplier.branches)),
      request,
    });
    return NextResponse.json({ item: serialize(supplier.branches) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar las sucursales" },
      { status: 400 },
    );
  }
}
