import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { branchProductWhere } from "@/lib/branch";
import { prisma } from "@/lib/prisma";
import { removeProductEntirely, removeProductFromBranch } from "@/lib/product-catalog";

const ALLOWED_ACTIONS = new Set([
  "favorite",
  "unfavorite",
  "publish",
  "draft",
  "hide",
  "archive",
  "activateBranch",
  "deactivateBranch",
  "delete",
]);

/**
 * @summary Acciones masivas sobre productos del catálogo.
 *
 * Body: { action, ids }. Las acciones de estado y favorito operan sobre el
 * maestro; las de sucursal (activate/deactivateBranch) requieren una sucursal
 * activa en la URL y ajustan la publicación por local; "delete" quita la
 * publicación de la sucursal activa o elimina el producto maestro completo.
 */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  try {
    const body = (await request.json()) as { action?: string; ids?: unknown };
    const action = body.action ?? "";
    if (!ALLOWED_ACTIONS.has(action)) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    const ids = [...new Set((Array.isArray(body.ids) ? body.ids : []).map(Number).filter(Number.isInteger))];
    if (!ids.length) return NextResponse.json({ error: "Seleccioná al menos un producto" }, { status: 400 });

    const where = { ...branchProductWhere(auth.tenant.id, auth.activeBranchId), id: { in: ids } };
    const scoped = await prisma.product.findMany({ where, select: { id: true } });
    const scopedIds = scoped.map((product) => product.id);
    if (!scopedIds.length) return NextResponse.json({ error: "Ningún producto coincide" }, { status: 404 });

    if (action === "favorite") {
      await prisma.product.updateMany({ where: { id: { in: scopedIds }, tenantId: auth.tenant.id }, data: { favorite: true } });
    } else if (action === "unfavorite") {
      await prisma.product.updateMany({ where: { id: { in: scopedIds }, tenantId: auth.tenant.id }, data: { favorite: false } });
    } else if (action === "publish" || action === "draft" || action === "hide" || action === "archive") {
      const statusMap = { publish: "published", draft: "draft", hide: "hidden", archive: "archived" } as const;
      await prisma.product.updateMany({
        where: { id: { in: scopedIds }, tenantId: auth.tenant.id },
        data: { status: statusMap[action] },
      });
    } else if (action === "activateBranch" || action === "deactivateBranch") {
      if (!auth.activeBranchId || auth.activeBranchId <= 0) {
        return NextResponse.json({ error: "Elegí una sucursal en la URL para esta acción" }, { status: 400 });
      }
      await prisma.branchProduct.updateMany({
        where: { productId: { in: scopedIds }, branchId: auth.activeBranchId, tenantId: auth.tenant.id },
        data: { active: action === "activateBranch" },
      });
    } else if (action === "delete") {
      for (const productId of scopedIds) {
        if (auth.activeBranchId && auth.activeBranchId > 0) {
          await removeProductFromBranch(auth.tenant.id, productId, auth.activeBranchId);
        } else {
          await removeProductEntirely(auth.tenant.id, productId);
        }
      }
    }

    await recordAudit({
      context: auth,
      action: "bulk",
      entityType: "productos",
      newValues: { action, ids: scopedIds },
      request,
    });
    return NextResponse.json({ updated: scopedIds.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo completar la acción masiva" },
      { status: 400 },
    );
  }
}
