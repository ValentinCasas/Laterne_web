import Link from "next/link";
import { getDefaultTenant } from "@/lib/tenant";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { requestRouteContext } from "@/lib/request-route-context";
import { Icon } from "@/components/admin/ui/icons";

/** @summary Explica el estado sin conexión y conserva el contexto tenant/branch en los enlaces. */
export default async function OfflinePage() {
  const [tenant, route] = await Promise.all([getDefaultTenant(), requestRouteContext()]);
  const href = (path: string) =>
    publicHrefForVisiblePath(route.originalPath, tenant.slug, path, route.branchSlug);
  return (
    <main className="shell grid min-h-[70vh] place-items-center py-12">
      <section className="card max-w-xl p-8 text-center">
        <Icon name="wifi-off" className="mx-auto text-5xl text-zinc-500" />
        <p className="section-eyebrow mt-5">Sin conexión</p>
        <h1 className="mt-2 text-4xl font-black">La red se tomó una pausa.</h1>
        <p className="mt-4 text-zinc-400">
          Podés intentar volver a la carta disponible en este dispositivo o reintentar cuando regrese
          internet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link className="btn" href={href("/carta")}>
            Abrir carta
          </Link>
          <Link className="btn btn-secondary" href={href("/")}>
            Reintentar
          </Link>
        </div>
      </section>
    </main>
  );
}
