import { notFound, redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { platformBranchPath } from "@/lib/routes";

/**
 * @summary Redirige el detalle heredado de sucursal a la URL canónica con GUID.
 *
 * El primer segmento dinámico se llama `guid` para respetar la regla de Next de
 * nombres consistentes entre rutas hermanas, pero aquí contiene el slug legado.
 */
export default async function LegacyPlatformBranchDetailPage({
  params,
}: {
  params: Promise<{ guid: string; branchSlug: string }>;
}) {
  await requireSuperAdmin();
  const [tenantSlug, branchSlug] = await Promise.all([(await params).guid, (await params).branchSlug]);
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug.trim().toLocaleLowerCase("es") },
    select: { publicGuid: true },
  });
  if (!tenant) notFound();
  redirect(platformBranchPath(tenant.publicGuid, tenantSlug, branchSlug));
}