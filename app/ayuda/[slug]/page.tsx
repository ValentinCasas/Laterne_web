import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** @summary Muestra el contenido completo de una guía del centro de ayuda. */
export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await getDefaultTenant();
  const article = await prisma.helpArticle.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug } },
  });
  if (!article || article.status !== "published") notFound();

  return (
    <main className="shell py-12 sm:py-20">
      <p className="section-eyebrow">{article.category}</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black sm:text-6xl">{article.title}</h1>
      <p className="mt-4 max-w-2xl text-zinc-400">{article.summary}</p>
      <article className="card mt-8 max-w-3xl whitespace-pre-wrap p-6 leading-relaxed text-zinc-300 sm:p-8">
        {article.content}
      </article>
      <Link className="btn btn-secondary mt-8" href="/ayuda">
        Volver al centro de ayuda
      </Link>
    </main>
  );
}
