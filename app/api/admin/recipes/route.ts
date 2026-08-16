import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { loadRecipeBoardData } from "@/lib/recipe-data";

/**
 * @summary Listado del módulo de recetas: productos con su costo de receta calculado.
 *
 * GET devuelve el payload del tablero (productos con costo/margen, candidatos a
 * ingrediente y conversiones de unidades) dentro del alcance de tenant y
 * sucursal activa.
 */
export async function GET() {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const payload = await loadRecipeBoardData(auth);
  return NextResponse.json({ payload: serialize(payload) });
}
