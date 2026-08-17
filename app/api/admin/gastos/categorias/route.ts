import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit, toAuditValue } from "@/lib/audit";
import { authorize } from "@/lib/auth";
import { createExpenseCategory, listExpenseCategories } from "@/lib/expenses";
import { serialize } from "@/lib/format";

const categoryInput = z.object({
  group: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(120),
});

/** @summary Lista categorías de gasto del tenant. */
export async function GET(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const url = new URL(request.url);
  const categories = await listExpenseCategories(auth.tenant.id, url.searchParams.get("all") === "1");
  return NextResponse.json(serialize(categories));
}

/** @summary Crea una categoría de gasto. */
export async function POST(request: Request) {
  const auth = await authorize("purchase.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const parsed = categoryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revisá los datos de la categoría" }, { status: 400 });

  try {
    const category = await createExpenseCategory(auth.tenant.id, parsed.data);
    await recordAudit({
      context: auth,
      action: "create",
      entityType: "expense-category",
      entityId: category.id,
      newValues: toAuditValue(serialize(category)),
      request,
    });
    return NextResponse.json({ item: serialize(category) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo crear la categoría" },
      { status: error instanceof Error && "status" in error ? (error as { status?: number }).status ?? 400 : 400 },
    );
  }
}
