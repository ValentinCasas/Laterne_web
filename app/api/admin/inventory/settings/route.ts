import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { inventoryPolicy, updateInventoryPolicy } from "@/lib/inventory";

/**
 * @summary Configuración de inventario del negocio.
 * GET devuelve la política vigente; PUT actualiza la política de venta sin stock
 * (strict impide vender, warn vende con advertencia).
 */
const settingsInput = z.object({
  stockPolicy: z.enum(["strict", "warn"]),
});

export async function GET() {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const settings = await inventoryPolicy(auth.tenant.id);
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = settingsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Política de stock inválida" }, { status: 400 });

  const settings = await updateInventoryPolicy(auth.tenant.id, parsed.data.stockPolicy);
  await recordAudit({
    context: auth,
    action: "inventory.settings",
    entityType: "inventory",
    entityId: auth.tenant.id,
    newValues: toAuditValue(settings),
    request,
  });
  return NextResponse.json(settings);
}
