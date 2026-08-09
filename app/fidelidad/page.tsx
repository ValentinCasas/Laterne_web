import { LoyaltyPortal } from "@/components/loyalty/loyalty-portal";

export const metadata = {
  title: "Clientes frecuentes",
  description: "Puntos, beneficios e historial de Laterne.",
};

/** @summary Presenta el portal privado de fidelización y control de datos personales. */
export default function LoyaltyPage() {
  return (
    <main className="shell py-10 sm:py-16">
      <LoyaltyPortal />
    </main>
  );
}
