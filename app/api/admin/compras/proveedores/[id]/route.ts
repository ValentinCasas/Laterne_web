import { NextResponse } from "next/server";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { updateSupplier, getSupplierDetail } from "@/lib/purchases";

/** @summary Ficha completa de un proveedor. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  try {
    const supplier = await getSupplierDetail(auth.tenant.id, Number(id));
    return NextResponse.json(serialize(supplier));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo cargar el proveedor" },
      { status: 404 },
    );
  }
}

/** @summary Actualiza datos del proveedor y sus sucursales habilitadas. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const parsed = await request.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Revisá los datos del proveedor" }, { status: 400 });
  }

  try {
    const branchIds = Array.isArray(parsed.branchIds) ? parsed.branchIds.map(Number) : undefined;
    const supplier = await updateSupplier(auth.tenant.id, Number(id), {
      name: parsed.name,
      code: parsed.code,
      taxId: parsed.taxId ?? null,
      contactName: parsed.contactName ?? null,
      phone: parsed.phone ?? null,
      email: parsed.email ?? null,
      address: parsed.address ?? null,
      paymentTerms: parsed.paymentTerms ?? null,
      currency: parsed.currency ?? null,
      status: parsed.status ?? null,
      category: parsed.category ?? null,
      creditLimit: parsed.creditLimit ?? null,
      blockedAt: parsed.blockedAt ?? null,
      blockedReason: parsed.blockedReason ?? null,
      notes: parsed.notes ?? null,
      active: parsed.active,
      branchIds,
    });
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
    const result = await prisma.supplier.deleteMany({ where: { id: Number(id), tenantId: auth.tenant.id } });
    if (!result.count) return NextResponse.json({ error: "El proveedor no existe" }, { status: 404 });
    await recordAudit({
      context: auth,
      action: "delete",
      entityType: "supplier",
      entityId: Number(id),
      newValues: { deleted: true },
      request,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo eliminar el proveedor" },
      { status: 409 },
    );
  }
}
