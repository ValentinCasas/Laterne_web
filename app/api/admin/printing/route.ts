import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { loadPrintingData } from "@/lib/printing-data";

/** @summary Devuelve la configuración de impresión del contexto de sucursal visible. */
export async function GET() {
  const auth = await authorize("order.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const payload = await loadPrintingData(auth);
  return NextResponse.json(payload);
}
