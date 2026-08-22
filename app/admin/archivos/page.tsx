import { MediaLibrary, type MediaAssetData } from "@/components/admin/media-library";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga la biblioteca multimedia registrada y sus responsables de carga. */
export default async function MediaPage() {
  const context = await requirePermission("media.manage");
  const where = {
    tenantId: context.tenant.id,
    ...(context.activeBranchId && context.activeBranchId > 0
      ? { OR: [{ branchId: context.activeBranchId }, { branchId: null }] }
      : {}),
  };
  const [assets, totalAssets, folderRows] = await Promise.all([prisma.mediaAsset.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  }), prisma.mediaAsset.count({ where }), prisma.mediaAsset.groupBy({ by: ["folder"], where })]);
  return (
    <MediaLibrary
      initialAssets={serialize(assets) as unknown as MediaAssetData[]}
      initialTotal={totalAssets}
      folders={folderRows.map((row) => row.folder).sort((a, b) => a.localeCompare(b, "es"))}
    />
  );
}
