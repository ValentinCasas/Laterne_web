import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { createCountSession, loadCountSessions } from "@/lib/inventory";

/**
 * @summary Sesiones de conteo físico.
 * POST abre una sesión con la cantidad de sistema de cada existencia;
 * GET lista el historial de sesiones.
 */
const createInput = z.object({
  branchId: z.coerce.number().int().positive(),
  note: z.string().trim().max(300).optional(),
});

/** @summary Lista sesiones de conteo recientes. */
export async function GET(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  const branchId = Number(url.searchParams.get("branchId") ?? 0);
  const sessions = await loadCountSessions(auth.tenant.id, branchId > 0 ? branchId : undefined);
  return NextResponse.json({ sessions: serialize(sessions) });
}

/** @summary Abre una nueva sesión de conteo. */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = createInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del conteo" }, { status: 400 });
  if (!canAccessBranch(auth, parsed.data.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a esa sucursal" }, { status: 403 });
  }

  try {
    const session = await createCountSession(auth.tenant.id, parsed.data.branchId, {
      note: parsed.data.note,
      userId: auth.session.userId,
    });
    await recordAudit({
      context: auth,
      action: "inventory.count.open",
      entityType: "conteos",
      entityId: session.id,
      newValues: toAuditValue({ reference: session.reference, items: session.items.length }),
      request,
    });
    return NextResponse.json({ session: serialize(session) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo abrir el conteo" },
      { status: 400 },
    );
  }
}
