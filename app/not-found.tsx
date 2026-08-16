import Link from "next/link";
import { headers } from "next/headers";
import { classifyHost } from "@/lib/domains";
import { publicHrefForVisiblePath } from "@/lib/routes";
import { getDefaultTenant, UnknownHostError } from "@/lib/tenant";

/** @summary Muestra un 404 neutro para MenuClick o uno tenant-aware en una URL pública canónica. */
export default async function NotFoundPage() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  const branchSlug =
    requestHeaders.get("x-menuclick-branch-slug")?.trim().toLocaleLowerCase("es") || undefined;
  const originalPath = requestHeaders.get("x-menuclick-original-path") || "/";
  const hostKind = classifyHost(host).kind;
  const tenantRequest = routeKind === "tenant-public" || hostKind === "tenant";

  let tenant = null;
  if (tenantRequest) {
    try {
      tenant = await getDefaultTenant();
    } catch (error) {
      if (!(error instanceof UnknownHostError)) throw error;
    }
  }

  if (!tenant) {
    return (
      <main className="grid min-h-[70vh] place-items-center bg-zinc-950 px-4 py-12 text-center">
        <section className="max-w-md">
          <p className="text-8xl font-black text-zinc-800">404</p>
          <h1 className="mt-3 text-2xl font-bold text-zinc-100">Página no encontrada</h1>
          <p className="mt-3 text-sm text-zinc-500">El sitio o contenido solicitado no está disponible.</p>
          <Link className="btn mt-6" href="/">
            Volver a MenuClick
          </Link>
        </section>
      </main>
    );
  }

  const publicHref = (href: string) => publicHrefForVisiblePath(originalPath, tenant.slug, href, branchSlug);
  return (
    <main className="shell grid min-h-[72vh] place-items-center py-12">
      <section className="max-w-2xl text-center">
        <p className="text-8xl font-black text-pink-500">404</p>
        <h1 className="mt-3 text-4xl font-black">Esta mesa quedó vacía.</h1>
        <p className="mt-4 text-zinc-400">
          La página no existe, cambió de dirección o dejó de estar publicada.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link className="btn" href={publicHref("/carta")}>
            Ir a la carta
          </Link>
          <Link className="btn btn-secondary" href={publicHref("/")}>
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
