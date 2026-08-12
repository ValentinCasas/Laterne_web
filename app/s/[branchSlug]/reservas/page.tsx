import { redirect } from "next/navigation";

/** @summary Mantiene la reserva dentro del contexto público de la sucursal. */
export default async function BranchReservationsPage({ params }: { params: Promise<{ branchSlug: string }> }) {
  redirect(`/reservas?branch=${encodeURIComponent((await params).branchSlug)}`);
}
