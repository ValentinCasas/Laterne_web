import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { loadSalonData } from "@/lib/salon-data";

/** @summary Devuelve el estado fresco del salón para el contexto de sucursal visible. */
export async function GET() {
  const auth = await authorize("table.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const payload = await loadSalonData(auth);
  return NextResponse.json(payload);
}
