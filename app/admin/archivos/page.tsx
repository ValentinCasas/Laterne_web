import { MediaLibrary, type MediaAssetData } from "@/components/admin/media-library";
import { requirePermission } from "@/lib/auth";
import { serialize } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** @summary Carga la biblioteca multimedia registrada y sus responsables de carga. */
export default async function MediaPage() {
  const context = await requirePermission("media.manage");
  const assets = await prisma.mediaAsset.findMany({
    where: { tenantId: context.tenant.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 2000,
  });
  return <MediaLibrary initialAssets={serialize(assets) as unknown as MediaAssetData[]} />;
}
