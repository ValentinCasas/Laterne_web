import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { classifyHost } from "@/lib/domains";
import { getSession } from "@/lib/auth";

/** @summary Presenta el acceso a la experiencia de plataforma o de administración según el host. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ tenantId?: string }> }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "";
  const { kind } = classifyHost(host);
  const platform = kind === "platform";
  const redirectTo = platform ? "/superadmin" : "/admin";

  if (await getSession()) redirect(redirectTo);
  const requestedTenantId = (await searchParams).tenantId;
  return (
    <main className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-12">
      <section className="card w-full max-w-md p-8">
        <p className="font-bold uppercase tracking-widest text-pink-400">
          {platform ? "Plataforma MenuClick" : "Acceso MenuClick"}
        </p>
        <h1 className="mt-2 text-3xl font-black">Ingresar</h1>
        <LoginForm redirectTo={redirectTo} initialTenantId={requestedTenantId} />
      </section>
    </main>
  );
}
