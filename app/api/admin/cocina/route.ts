import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { loadKdsData } from "@/lib/kds-data";

/** @summary Devuelve el estado fresco del monitor de cocina para el contexto de sucursal visible. */
export async function GET() {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const payload = await loadKdsData(auth);
  return NextResponse.json(payload);
}
