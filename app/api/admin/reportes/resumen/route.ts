import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { resolvePeriod } from "@/lib/reports/period";
import { computeVentasKpis, computeEvolution } from "@/lib/reports/sales";
import { computeProductRanking } from "@/lib/reports/products";

/** @summary Resumen general de reportes para el período seleccionado. */
export async function GET(request: Request) {
  const auth = await authorize("analytics.read");
  if (!auth) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const requestedBranchId = url.searchParams.has("branchId") ? Number(url.searchParams.get("branchId")) : null;

  let branchId: number | null = null;
  if (requestedBranchId && requestedBranchId > 0) {
    if (!canAccessBranch(auth, requestedBranchId)) return new Response("No autorizado", { status: 403 });
    branchId = requestedBranchId;
  } else if (auth.allBranches && auth.activeBranchId === 0) {
    branchId = null;
  } else if (auth.activeBranchId && auth.activeBranchId > 0) {
    branchId = auth.activeBranchId;
  }

  const period = resolvePeriod({ from: rawFrom || undefined, to: rawTo || undefined });
  const filters = { branchId };

  const [kpis, evolution, topProducts] = await Promise.all([
    computeVentasKpis(auth.tenant.id, period, filters),
    computeEvolution(auth.tenant.id, period, filters, "day"),
    computeProductRanking(auth.tenant.id, period, filters, 5),
  ]);

  return new Response(JSON.stringify(serialize({ kpis, evolution, topProducts: topProducts.ranking })), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
