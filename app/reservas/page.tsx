import { ReservationsPageContent } from "@/components/reservations/reservations-page-content";
import { managedPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** @summary Recupera la configuración SEO administrable de reservas. */
export function generateMetadata() {
  return managedPageMetadata("/reservas", "Reservas", "Consultá disponibilidad y solicitá una mesa.");
}

/** @summary Presenta las reservas consolidadas del tenant. */
export default async function ReservationsPage() {
  return <ReservationsPageContent />;
}
