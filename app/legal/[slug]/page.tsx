import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

type LegalPageProps = { params: Promise<{ slug: string }> };

/** @summary Muestra un documento legal publicado como texto seguro y legible. */
export default async function LegalPage({ params }: LegalPageProps) {
  const [{ slug }, tenant] = await Promise.all([params, getDefaultTenant()]);
  const page = await prisma.legalPage.findFirst({
    where: { tenantId: tenant.id, slug, status: "published" },
  });
  if (!page) notFound();
  return (
    <main className="shell py-12 sm:py-20">
      <article className="mx-auto max-w-4xl">
        <p className="section-eyebrow">Información legal</p>
        <h1 className="mt-3 text-4xl font-black sm:text-6xl">{page.title}</h1>
        <time className="mt-3 block text-sm text-zinc-500">
          Última actualización: {page.updatedAt.toLocaleDateString("es-AR")}
        </time>
        <div className="mt-8 whitespace-pre-wrap rounded-3xl border border-white/10 bg-zinc-950 p-6 leading-8 text-zinc-300 sm:p-10">
          {page.content}
        </div>
      </article>
    </main>
  );
}
