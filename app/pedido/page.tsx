import { CheckoutForm } from "@/components/orders/checkout-form";

export const metadata = {
  title: "Confirmar pedido",
  description: "Revisá y confirmá tu pedido en Laterne.",
};

/** @summary Presenta el checkout público para guardar un pedido y verificar sus datos finales. */
export default function OrderPage() {
  return (
    <main className="shell py-10 sm:py-16">
      <p className="section-eyebrow">Pedido online</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-.05em] sm:text-6xl">
        Todo listo para pedir.
      </h1>
      <p className="mb-8 mt-4 max-w-2xl text-zinc-400">
        Confirmá tus datos. Vas a obtener un número interno y una página privada para seguir el estado.
      </p>
      <CheckoutForm />
    </main>
  );
}
