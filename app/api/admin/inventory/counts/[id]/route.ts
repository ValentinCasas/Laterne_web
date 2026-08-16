import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loadCountSessionDetail, updateCountSessionItems } from "@/lib/inventory";

/**
 * @summary Detalle y carga de cantidades contadas de una sesión de conteo.
 * GET devuelve la sesión con sus ítems; PATCH registra las cantidades contadas
 * y recalcula las diferencias.
 */
const itemsInput = z.object({
  items: z
    .array(
      z.object({
        id: z.coerce.number().int().positive(),
        countedQuantity: z.coerce.number().min(0).max(1_000_000),
      }),
    )
    .max(500),
});

/** @summary Detalle de una sesión de conteo. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Conteo inválido" }, { status: 404 });

  const session = await loadCountSessionDetail(auth.tenant.id, id);
  if (!session) return NextResponse.json({ error: "Conteo no encontrado" }, { status: 404 });
  if (!canAccessBranch(auth, session.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este conteo" }, { status: 403 });
  }
  return NextResponse.json({ session: serialize(session) });
}

/** @summary Registra cantidades contadas en la sesión abierta. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Conteo inválido" }, { status: 404 });
  const parsed = itemsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá las cantidades contadas" }, { status: 400 });

  const session = await loadCountSessionDetail(auth.tenant.id, id);
  if (!session) return NextResponse.json({ error: "Conteo no encontrado" }, { status: 404 });
  if (!canAccessBranch(auth, session.branchId)) {
    return NextResponse.json({ error: "No tenés acceso a la sucursal de este conteo" }, { status: 403 });
  }

  try {
    const result = await updateCountSessionItems(auth.tenant.id, id, parsed.data.items);
    return NextResponse.json({ result: serialize(result) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudieron guardar las cantidades" },
      { status: 400 },
    );
  }
}
