import { CheckoutForm } from "@/components/orders/checkout-form";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";
import { managedPageMetadata } from "@/lib/seo";

/** @summary Recupera metadatos administrables y evita indexar datos transaccionales del pedido. */
export async function generateMetadata() {
  const metadata = await managedPageMetadata("/pedido", "Confirmar pedido", "Revisá y confirmá tu pedido.");
  return { ...metadata, robots: { index: false, follow: false } };
}

/** @summary Presenta el checkout público para guardar un pedido y verificar sus datos finales. */
export default async function OrderPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const tenant = await getDefaultTenant();
  const requestedBranch = (await searchParams).branch;
  const branches = await prisma.branch.findMany({
    where: { tenantId: tenant.id, active: true },
    select: { id: true, name: true, slug: true, address: true, deliveryFee: true, minimumOrder: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
  return (
    <main className="shell py-10 sm:py-16">
      <p className="section-eyebrow">Pedido online</p>
      <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-.05em] sm:text-6xl">
        Todo listo para pedir.
      </h1>
      <p className="mb-8 mt-4 max-w-2xl text-zinc-400">
        Confirmá tus datos. Vas a obtener un número interno y una página privada para seguir el estado.
      </p>
      <CheckoutForm
        branches={branches.map((branch) => ({
          ...branch,
          deliveryFee: Number(branch.deliveryFee),
          minimumOrder: Number(branch.minimumOrder),
        }))}
        currency={tenant.defaultCurrency}
        locale={tenant.locale}
        fixedBranchSlug={requestedBranch}
      />
    </main>
  );
}
