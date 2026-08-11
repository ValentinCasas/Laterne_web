import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { managedPageMetadata } from "@/lib/seo";
import { MarketingShell } from "@/components/commercial/marketing-shell";

export const dynamic = "force-dynamic";

/** @summary Recupera la configuración SEO administrable del portfolio comercial. */
export function generateMetadata() {
  return managedPageMetadata(
    "/clientes",
    "Clientes y casos de éxito",
    "Negocios gastronómicos que conectan su carta y operación con MenuClick.",
  );
}

/** @summary Presenta implementaciones reales publicadas como portfolio comercial. */
export default async function ClientsPage() {
  const cases = await prisma.successCase.findMany({
    where: { isPublicCaseStudy: true, status: "published" },
    include: { tenant: { select: { name: true } } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return (
    <MarketingShell>
    <main className="shell py-12 sm:py-20">
      <p className="section-eyebrow">Clientes MenuClick</p>
      <h1 className="mt-3 max-w-4xl text-5xl font-black sm:text-7xl">
        Tecnología que se nota en la experiencia.
      </h1>
      <p className="mt-5 max-w-2xl text-zinc-400">
        Casos públicos autorizados por negocios que usan MenuClick. Sin métricas inventadas, solo experiencias reales.
      </p>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {cases.map((item) => (
          <Link
            className="group overflow-hidden rounded-3xl border border-white/10 bg-zinc-950"
            href={`/clientes/${item.slug}`}
            key={item.id}
          >
            <div className="relative aspect-[16/8] bg-gradient-to-br from-pink-950/40 to-zinc-950">
              {item.coverUrl && (
                <Image
                  src={`/images/images_cases/${item.coverUrl}`}
                  alt={`Portada de ${item.businessName}`}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              )}
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-widest text-pink-300">
                 {item.tenant.name} · {item.businessType} · {item.location}
              </p>
              <h2 className="mt-2 text-3xl font-black">{item.businessName}</h2>
              <p className="mt-3 line-clamp-3 text-zinc-400">{item.results}</p>
              <span className="mt-5 inline-block font-bold text-pink-300">Ver caso completo →</span>
            </div>
          </Link>
        ))}
        {!cases.length && (
          <section className="card p-10 text-zinc-500">
            Los casos publicados aparecerán en esta sección.
          </section>
        )}
      </div>
    </main>
    </MarketingShell>
  );
}
