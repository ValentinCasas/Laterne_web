import { notFound } from "next/navigation";
import { ReservationsPageContent } from "@/components/reservations/reservations-page-content";
import { resolvePublicBranch } from "@/lib/branch";
import { getDefaultTenant } from "@/lib/tenant";

/** @summary Mantiene la reserva dentro del contexto público explícito de la sucursal. */
export default async function BranchReservationsPage({
  params,
}: {
  params: Promise<{ branchSlug: string }>;
}) {
  const tenant = await getDefaultTenant();
  const { branchSlug } = await params;
  const branch = await resolvePublicBranch(tenant.id, branchSlug);
  if (!branch || !branch.operative) notFound();
  return <ReservationsPageContent branchSlug={branch.branchSlug} />;
}
