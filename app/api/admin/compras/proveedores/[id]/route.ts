import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { updateSupplier, removeSupplier } from "@/lib/purchases";

/** @summary Detalle, edición y eliminación de un proveedor. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const suppliers = await prisma.supplier.findMany({
    where: { id: Number(id), tenantId: auth.tenant.id },
    select: { id: true, name: true, taxId: true, contactName: true, phone: true, email: true, address: true, paymentTerms: true, notes: true, active: true },
  });
  const supplier = suppliers[0];
  if (!supplier) return NextResponse.json({ error: "El proveedor no existe" }, { status: 404 });
  return NextResponse.json(serialize(supplier));
}

/** @summary Actualiza un proveedor. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Revisá los datos del proveedor" }, { status: 400 });
  }

  try {
    const updated = await updateSupplier(auth.tenant.id, Number(id), {
      name: parsed.name,
      taxId: parsed.taxId ?? null,
      contactName: parsed.contactName ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      address: parsed.address ?? null,
      paymentTerms: parsed.paymentTerms ?? null,
      notes: parsed.notes ?? null,
      active: parsed.active,
    });
    if (!updated.count) return NextResponse.json({ error: "El proveedor no existe" }, { status: 404 });
    const supplier = await prisma.supplier.findFirst({ where: { id: Number(id), tenantId: auth.tenant.id } });
    await recordAudit({
      context: auth,
      action: "update",
      entityType: "supplier",
      entityId: Number(id),
      newValues: toAuditValue(serialize(supplier)),
      request,
    });
    return NextResponse.json({ item: serialize(supplier) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo actualizar el proveedor" },
      { status: 400 },
    );
  }
}

/** @summary Elimina un proveedor sin documentos asociados. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const result = await removeSupplier(auth.tenant.id, Number(id));
    await recordAudit({
      context: auth,
      action: "delete",
      entityType: "supplier",
      entityId: Number(id),
      newValues: { deleted: true },
      request,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el proveedor" },
      { status: 409 },
    );
  }
}
