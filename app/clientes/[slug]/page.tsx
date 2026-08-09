import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

type ClientCaseProps = { params: Promise<{ slug: string }> };

/** @summary Detalla el desafío, implementación y resultados de un caso de éxito publicado. */
export default async function ClientCasePage({ params }: ClientCaseProps) {
  const [{ slug }, tenant] = await Promise.all([params, getDefaultTenant()]);
  const item = await prisma.successCase.findFirst({
    where: { tenantId: tenant.id, slug, status: "published" },
  });
  if (!item) notFound();
  return (
    <main className="shell py-12 sm:py-20">
      <article className="mx-auto max-w-5xl">
        <p className="section-eyebrow">
          {item.businessType} · {item.location}
        </p>
        <h1 className="mt-3 text-5xl font-black sm:text-8xl">{item.businessName}</h1>
        {item.coverUrl && (
          <div className="relative mt-8 aspect-[16/7] overflow-hidden rounded-3xl">
            <Image
              src={`/images/images_cases/${item.coverUrl}`}
              alt={`Portada de ${item.businessName}`}
              fill
              priority
              className="object-cover"
            />
          </div>
        )}
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <section className="card p-6">
            <p className="section-eyebrow">El desafío</p>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-300">{item.initialProblem}</p>
          </section>
          <section className="card p-6">
            <p className="section-eyebrow">La solución</p>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-300">{item.solution}</p>
          </section>
          <section className="card p-6">
            <p className="section-eyebrow">Funciones</p>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-300">{item.features}</p>
          </section>
          <section className="card border-pink-500/30 bg-pink-500/5 p-6">
            <p className="section-eyebrow">Resultados</p>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed text-zinc-200">{item.results}</p>
          </section>
        </div>
        {item.testimonial && (
          <blockquote className="mt-8 rounded-3xl border border-white/10 p-8 text-2xl font-bold leading-relaxed">
            “{item.testimonial}”
          </blockquote>
        )}
        {item.websiteUrl && (
          <a className="btn mt-8" href={item.websiteUrl} target="_blank" rel="noreferrer">
            Visitar sitio
          </a>
        )}
      </article>
    </main>
  );
}
