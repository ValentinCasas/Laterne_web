import { LoyaltyPortal } from "@/components/loyalty-portal";
import { managedPageMetadata } from "@/lib/seo";

/** @summary Recupera la configuración SEO administrable del programa de fidelización. */
export function generateMetadata() {
  return managedPageMetadata(
    "/fidelidad",
    "Clientes frecuentes",
    "Puntos, beneficios e historial de visitas.",
  );
}

/** @summary Presenta el portal privado de fidelización y control de datos personales. */
export default function LoyaltyPage() {
  return (
    <main className="shell py-10 sm:py-16">
      <LoyaltyPortal />
    </main>
  );
}
