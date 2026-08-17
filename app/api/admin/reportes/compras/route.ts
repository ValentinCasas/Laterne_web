import { authorize, canAccessBranch } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { resolvePeriod } from "@/lib/reports/period";
import { computeComprasKpis, computePurchaseItems } from "@/lib/reports/purchases";

const PAGE_SIZE = 50;

/** @summary Reporte de compras con KPIs y detalle cronológico. */
export async function GET(request: Request) {
  const auth = await authorize("analytics.read");
  if (!auth) return new Response("No autorizado", { status: 403 });

  const url = new URL(request.url);
  const rawFrom = url.searchParams.get("from");
  const rawTo = url.searchParams.get("to");
  const requestedBranchId = url.searchParams.has("branchId") ? Number(url.searchParams.get("branchId")) : null;
  const supplierId = url.searchParams.has("supplierId") ? Number(url.searchParams.get("supplierId")) : null;
  const productId = url.searchParams.has("productId") ? Number(url.searchParams.get("productId")) : null;
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));

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
  const filters = { branchId, supplierId, productId };

  const [kpis, { items, total }] = await Promise.all([
    computeComprasKpis(auth.tenant.id, period, filters),
    computePurchaseItems(auth.tenant.id, period, filters, page, PAGE_SIZE),
  ]);

  return new Response(
    JSON.stringify(
      serialize({
        kpis,
        items,
        meta: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
      }),
    ),
    { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
}
