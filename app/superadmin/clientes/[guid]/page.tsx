import { notFound, redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { platformClientPath } from "@/lib/routes";

/**
 * @summary Redirige el detalle heredado `/platform/clientes/{slug}` a la URL canónica con GUID.
 *
 * El primer segmento dinámico se llama `guid` para respetar la regla de Next de
 * nombres consistentes entre rutas hermanas, pero aquí contiene el slug legado.
 */
export default async function LegacyPlatformClientDetailPage({
  params,
}: {
  params: Promise<{ guid: string }>;
}) {
  await requireSuperAdmin();
  const slug = (await params).guid.trim().toLocaleLowerCase("es");
  if (!slug) notFound();
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { publicGuid: true } });
  if (!tenant) notFound();
  redirect(platformClientPath(tenant.publicGuid, slug));
}