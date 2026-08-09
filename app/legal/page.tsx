import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** @summary Lista las políticas y condiciones publicadas por el negocio. */
export default async function LegalIndexPage() {
  const tenant = await getDefaultTenant();
  const pages = await prisma.legalPage.findMany({
    where: { tenantId: tenant.id, status: "published" },
    orderBy: { title: "asc" },
  });
  return (
    <main className="shell py-12 sm:py-20">
      <p className="section-eyebrow">Transparencia</p>
      <h1 className="mt-3 text-5xl font-black sm:text-7xl">Información legal</h1>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pages.map((page) => (
          <Link className="card p-6 hover:border-pink-500/40" href={`/legal/${page.slug}`} key={page.id}>
            <h2 className="text-xl font-black">{page.title}</h2>
            <p className="mt-2 text-sm text-zinc-500">
              Actualizada el {page.updatedAt.toLocaleDateString("es-AR")}
            </p>
          </Link>
        ))}
        {!pages.length && (
          <section className="card p-8 text-zinc-400 sm:col-span-2">
            El negocio todavía no publicó documentos legales.
          </section>
        )}
      </div>
    </main>
  );
}
