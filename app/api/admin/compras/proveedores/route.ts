import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { createSupplier, listSuppliers } from "@/lib/purchases";

const supplierInput = z.object({
  name: z.string().trim().min(1).max(180),
  taxId: z.string().trim().max(60).optional(),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  address: z.string().trim().max(240).optional(),
  paymentTerms: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** @summary Lista proveedores del tenant. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  const suppliers = await listSuppliers(auth.tenant.id, url.searchParams.get("q") || undefined);
  return NextResponse.json(serialize(suppliers));
}

/** @summary Crea un proveedor. */
export async function POST(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = supplierInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos del proveedor" }, { status: 400 });

  try {
    const supplier = await createSupplier(auth.tenant.id, parsed.data);
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "supplier",
      entityId: supplier.id,
      newValues: toAuditValue(serialize(supplier)),
      request,
    });
    return NextResponse.json({ item: serialize(supplier) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear el proveedor" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
