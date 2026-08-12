import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { classifyHost } from "@/lib/domains";
import { getSession } from "@/lib/auth";
import { HandoffClient } from "@/components/auth/handoff-client";
import { platformAdminPath, tenantAdminPath, tenantPublicPath } from "@/lib/routes";

/** @summary Presenta el acceso de plataforma o de un tenant según la URL canónica. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tenantId?: string; tenantSlug?: string; handoff?: string; returnTo?: string }>;
}) {
  const requestHeaders = await headers();
  const routeKind = requestHeaders.get("x-menuclick-route-kind") ?? "";
  const routeTenantSlug = requestHeaders.get("x-menuclick-tenant-slug")?.trim().toLocaleLowerCase("es");
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const hostKind = classifyHost(host).kind;
  const platform = routeKind === "platform-admin" || (!routeKind && hostKind === "platform");

  const params = await searchParams;
  if (params.handoff) return <HandoffClient token={params.handoff} />;

  const requestedTenantId = params.tenantId;
  const requestedTenantSlug = routeTenantSlug || params.tenantSlug;
  const defaultTarget = platform
    ? platformAdminPath()
    : requestedTenantSlug
      ? tenantAdminPath(requestedTenantSlug)
      : "";
  const safeReturnTo =
    params.returnTo &&
    (params.returnTo.startsWith("/platform") ||
      (requestedTenantSlug && params.returnTo.startsWith(`/t/${encodeURIComponent(requestedTenantSlug)}/`)))
      ? params.returnTo
      : undefined;

  const existingSession = await getSession();
  if (existingSession && (platform || requestedTenantSlug)) {
    redirect(safeReturnTo ?? defaultTarget);
  }

  const recoveryHref = platform
    ? "/platform/recuperar-acceso"
    : requestedTenantSlug
      ? tenantPublicPath(requestedTenantSlug, "/recuperar-acceso")
      : "/recuperar-acceso";

  return (
    <main className="mc-login-shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <section className="mc-login-card w-full max-w-md p-8">
        <p className="mc-eyebrow">{platform ? "Plataforma MenuClick" : requestedTenantSlug ? `Acceso · ${requestedTenantSlug}` : "Acceso MenuClick"}</p>
        <h1 className="mt-2 text-3xl font-black">Ingresar</h1>
        <LoginForm
          redirectTo={safeReturnTo}
          initialTenantId={requestedTenantId}
          initialTenantSlug={requestedTenantSlug}
          recoveryHref={recoveryHref}
        />
      </section>
    </main>
  );
}
