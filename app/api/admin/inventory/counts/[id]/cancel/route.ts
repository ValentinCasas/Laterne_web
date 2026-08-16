import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { cancelCountSession, loadCountSessionDetail } from "@/lib/inventory";

/**
 * @summary Cancela una sesión de conteo abierta sin aplicar ajustes.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Conteo inválido" }, { status: 404 });

  const session = await loadCountSessionDetail(auth.tenant.id, id);
  if (!session) return NextResponse.json({ error: "Conteo no encontrado" }, { status: 404 });
  if (!canAccessBranch(auth, session.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este conteo" }, { status: 403 });
  }

  try {
    await cancelCountSession(auth.tenant.id, id);
    await recordAudit({
      context: auth,
      action: "inventory.count.cancel",
      entityType: "conteos",
      entityId: id,
      newValues: toAuditValue({ reference: session.reference }),
      request,
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cancelar el conteo" },
      { status: 400 },
    );
  }
}
