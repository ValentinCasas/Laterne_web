import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { resolvePeriod } from "@/lib/reports/period";
import { computeProductRanking, computeProductKpis } from "@/lib/reports/products";

/** @summary Reporte de productos con ranking y márgenes. */
export async function GET(request: Request) {
  const auth = await authorize("analytics.read");
  if (!auth) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const requestedBranchId = url.searchParams.has("branchId") ? Number(url.searchParams.get("branchId")) : null;
  const categoryId = url.searchParams.has("categoryId") ? Number(url.searchParams.get("categoryId")) : null;
  const productId = url.searchParams.has("productId") ? Number(url.searchParams.get("productId")) : null;
  const top = Math.min(100, Math.max(5, Number(url.searchParams.get("top") || 10)));

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
  const filters = { branchId, categoryId, productId };

  const [kpis, ranking] = await Promise.all([
    computeProductKpis(auth.tenant.id, period, filters),
    computeProductRanking(auth.tenant.id, period, filters, top),
  ]);

  return new Response(
    JSON.stringify(serialize({ kpis, ranking: ranking.ranking, totalSales: ranking.totalSales, topProductsShare: ranking.topProductsShare })),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
