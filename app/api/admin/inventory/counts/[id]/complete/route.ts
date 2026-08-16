import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { completeCountSession, loadCountSessionDetail } from "@/lib/inventory";

/**
 * @summary Completa una sesión de conteo y aplica los ajustes de diferencia.
 * Cada diferencia se registra como movimiento `count_adjustment` con snapshot
 * de costo; el ajuste nunca deja stock negativo (guarda atómica).
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
    const result = await completeCountSession(auth.tenant.id, id, auth.session.userId);
    await recordAudit({
      context: auth,
      action: "inventory.count.complete",
      entityType: "conteos",
      entityId: id,
      newValues: toAuditValue({ adjustments: result.adjustments, reference: session.reference }),
      request,
    });
    return NextResponse.json({ result: serialize(result) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar el conteo" },
      { status: 400 },
    );
  }
}
