import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { classifyHost } from "@/lib/domains";
import { getSession } from "@/lib/auth";
import { HandoffClient } from "@/components/auth/handoff-client";
import { prisma } from "@/lib/prisma";

/** @summary Presenta el acceso a la experiencia de plataforma o de administración según el host. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ tenantId?: string; tenantSlug?: string; handoff?: string; returnTo?: string }> }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const { kind } = classifyHost(host);
  const platform = kind === "platform";
  const redirectTo = platform ? "/superadmin" : "/admin";

  const params = await searchParams;
  if (params.handoff) return <HandoffClient token={params.handoff} />;
  const requestedTenantId = params.tenantId;
  const requestedTenantSlug = params.tenantSlug;
  const returnTo = params.returnTo?.startsWith("/admin/") ? params.returnTo : undefined;
  const existingSession = await getSession();
  const hostTenantMatches = existingSession && kind === "app" && host.split(":")[0].toLocaleLowerCase("es")
    ? Boolean((await prisma.tenant.findFirst({ where: { id: existingSession.tenantId ?? -1 }, select: { slug: true } }))?.slug === host.split(":")[0].split(".")[0])
    : false;
  const directTenantHost = kind === "app" && !host.split(":")[0].toLocaleLowerCase("es").startsWith("app.");
  if (existingSession && !requestedTenantId && !requestedTenantSlug && !directTenantHost) redirect(redirectTo);
  if (existingSession && !requestedTenantId && !requestedTenantSlug && hostTenantMatches) redirect(redirectTo);
  if (existingSession && requestedTenantId && Number(requestedTenantId) === existingSession.tenantId) redirect(redirectTo);
  return (
    <main className="mc-login-shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <section className="mc-login-card w-full max-w-md p-8">
        <p className="mc-eyebrow">
          {platform ? "Plataforma MenuClick" : "Acceso MenuClick"}
        </p>
        <h1 className="mt-2 text-3xl font-black">Ingresar</h1>
        <LoginForm redirectTo={returnTo ?? redirectTo} initialTenantId={requestedTenantId} initialTenantSlug={requestedTenantSlug} />
      </section>
    </main>
  );
}
