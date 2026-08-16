import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import {
  ensureBranchCategory,
  ensureBranchProduct,
  ensureBranchStock,
  resolveEffectiveBranchId,
} from "@/lib/branch";
import { parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

/**
 * @summary Valida la entrada relacionada con el recurso solicitado.
 */
const importInput = z.object({
  csv: z.string().min(1).max(2_000_000),
  apply: z.boolean().default(false),
});
const requiredHeaders = ["nombre", "descripcion", "precio", "categoria"];

/** @summary Convierte una representación habitual de planilla en un valor booleano. */
function spreadsheetBoolean(value: string) {
  return ["1", "true", "si", "sí", "yes"].includes(value.trim().toLocaleLowerCase("es"));
}

/** @summary Valida todas las filas y, solo al confirmar, crea o actualiza productos y relaciones. */
export async function POST(request: Request) {
  const auth = await authorize("product.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = importInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Archivo inválido o demasiado grande" }, { status: 400 });
  }
  const rows = parseCsv(parsed.data.csv.replace(/^\uFEFF/, ""));
  const headers = rows[0]?.map((header) => header.trim().toLocaleLowerCase("es")) ?? [];
  const missing = requiredHeaders.filter((header) => !headers.includes(header));
  if (missing.length) {
    return NextResponse.json({ error: `Faltan columnas: ${missing.join(", ")}` }, { status: 400 });
  }
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  const errors: Array<{ row: number; message: string }> = [];
  const valid: Array<Record<string, string>> = [];
  for (let position = 1; position < rows.length; position += 1) {
    const row = rows[position];
    /** @summary Recupera una celda normalizada mediante el nombre esperado de su columna. */
    const value = (header: string) => row[index[header]]?.trim() ?? "";
    const price = Number(value("precio"));
    if (!value("nombre") || !value("descripcion") || !value("categoria")) {
      errors.push({ row: position + 1, message: "Faltan nombre, descripción o categoría" });
    } else if (!Number.isFinite(price) || price < 0) {
      errors.push({ row: position + 1, message: "El precio no es válido" });
    } else {
      valid.push(Object.fromEntries(headers.map((header) => [header, value(header)])));
    }
  }
  if (errors.length || !parsed.data.apply) {
    return NextResponse.json({ ok: !errors.length, preview: true, validRows: valid.length, errors });
  }
  const targetBranchId = await resolveEffectiveBranchId(auth.tenant.id, auth.activeBranchId);
  if (!targetBranchId) {
    return NextResponse.json(
      { error: "Elegí una sucursal en la URL antes de importar productos" },
      { status: 409 },
    );
  }
  for (const row of valid) {
    const category = await ensureBranchCategory(auth.tenant.id, targetBranchId, row.categoria || "General");
    const productSlug = slugify(row.slug || row.nombre) || `producto-${Date.now()}`;
    const data = {
      name: row.nombre,
      description: row.descripcion,
      price: Number(row.precio),
      availability: row.disponibilidad || "disponible",
      status: row.estado || "published",
      imageUrl: row.imagen || "product_default.png",
      featured: spreadsheetBoolean(row.destacado || ""),
      isNew: spreadsheetBoolean(row.nuevo || ""),
      recommended: spreadsheetBoolean(row.recomendado || ""),
    };
    const product = await prisma.product.upsert({
      where: { tenantId_slug: { tenantId: auth.tenant.id, slug: productSlug } },
      create: { tenantId: auth.tenant.id, slug: productSlug, ...data },
      update: data,
    });
    await ensureBranchProduct(auth.tenant.id, targetBranchId, product.id);
    await ensureBranchStock(auth.tenant.id, targetBranchId, product.id);
    await prisma.productCategory.upsert({
      where: { productId_categoryId: { productId: product.id, categoryId: category.id } },
      create: { tenantId: auth.tenant.id, productId: product.id, categoryId: category.id },
      update: { tenantId: auth.tenant.id },
    });
  }
  await recordAudit({
    context: auth,
    action: "import",
    entityType: "products",
    newValues: { rows: valid.length, branchId: targetBranchId },
    request,
  });
  return NextResponse.json({ ok: true, imported: valid.length, errors: [] });
}
