import { HelpCenter } from "@/components/help/help-center";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";
import { managedPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

/** @summary Recupera la configuración SEO administrable del centro de ayuda. */
export function generateMetadata() {
  return managedPageMetadata(
    "/ayuda",
    "Centro de ayuda",
    "Preguntas frecuentes, guías y soporte para clientes y visitantes.",
  );
}

/** @summary Reúne artículos públicos, buscador y contacto de soporte en una sola pantalla. */
export default async function HelpPage() {
  const tenant = await getDefaultTenant();
  const [articles, business] = await Promise.all([
    prisma.helpArticle.findMany({
      where: { tenantId: tenant.id, status: "published", audience: { in: ["public", "all"] } },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
    }),
    prisma.businessInfo.findUnique({ where: { tenantId: tenant.id } }),
  ]);
  return (
    <main className="shell py-12 sm:py-20">
      <p className="section-eyebrow">Centro de ayuda</p>
      <h1 className="mt-3 text-5xl font-black sm:text-7xl">¿Cómo podemos ayudarte?</h1>
      <p className="mb-10 mt-4 max-w-2xl text-zinc-400">
        Buscá una guía o envianos una consulta para que quede registrada.
      </p>
      <HelpCenter articles={articles} whatsapp={business?.phoneNumber?.toString() ?? ""} />
    </main>
  );
}
