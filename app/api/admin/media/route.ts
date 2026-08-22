import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Lista archivos con filtros y paginación server-side respetando tenant y sucursal. */
export async function GET(request: Request) {
  const auth = await authorize("media.manage");
  if (!auth) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const search = new URL(request.url).searchParams;
  const page = Math.max(1, Number(search.get("page")) || 1);
  const requestedPageSize = Number(search.get("pageSize")) || 25;
  const pageSize = [25, 50, 100].includes(requestedPageSize) ? requestedPageSize : 25;
  const query = search.get("q")?.trim().slice(0, 180) ?? "";
  const folder = search.get("folder")?.trim().slice(0, 120) ?? "";
  const where = {
    tenantId: auth.tenant.id,
    ...(auth.activeBranchId && auth.activeBranchId > 0
      ? { OR: [{ branchId: auth.activeBranchId }, { branchId: null }] }
      : {}),
    ...(folder ? { folder } : {}),
    ...(query
      ? {
          AND: [
            {
              OR: [
                { filename: { contains: query } },
                { altText: { contains: query } },
                { mimeType: { contains: query } },
              ],
            },
          ],
        }
      : {}),
  };
  const [assets, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.mediaAsset.count({ where }),
  ]);
  return NextResponse.json({ assets: serialize(assets), total, page, pageSize });
}
