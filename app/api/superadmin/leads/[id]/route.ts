import { NextResponse } from "next/server";
import { leadStatusSchema, updateLeadStatus } from "@/lib/leads";
import { authorizeSuperAdmin } from "@/lib/auth";

/** @summary Cambia el estado comercial de una oportunidad desde la plataforma, con historial y auditoría. */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const id = Number((await context.params).id);
  const parsed = leadStatusSchema.safeParse(await request.json());
  if (!Number.isInteger(id) || !parsed.success) {
    return NextResponse.json({ error: "Estado u oportunidad inválidos" }, { status: 400 });
  }
  return updateLeadStatus({ id, status: parsed.data.status, note: parsed.data.note, auth, request });
}
