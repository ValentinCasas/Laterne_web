import type { ReactNode } from "react";
import Link from "next/link";
import { requireDriver } from "@/lib/auth";
import { tenantDriverGuidPath } from "@/lib/routes";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** @summary Layout móvil-first de la vista personal del repartidor con navegación inferior. */
export default async function DriverLayout({ children }: { children: ReactNode }) {
  const context = await requireDriver();
  const profile = await prisma.driverProfile.findFirst({
    where: { tenantId: context.tenant.id, userId: context.session.userId },
    select: { id: true, name: true, status: true, active: true },
  });

  const driverHome = tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug);
  const nav = [
    { href: driverHome, label: "Entregas", icon: "🛵", active: false },
    { href: tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug, "/entregas"), label: "Historial", icon: "📋", active: false },
    { href: tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug, "/incidencias"), label: "Incidencias", icon: "⚠️", active: false },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href={driverHome} className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-pink-600 text-sm font-black">🛵</span>
            <span>
              <p className="text-sm font-black leading-tight">{profile?.name ?? context.user.name}</p>
              <p className="text-[10px] text-zinc-400">{context.tenant.name}</p>
            </span>
          </Link>
          {profile && (
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                profile.active && profile.status === "AVAILABLE"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {profile.active && profile.status === "AVAILABLE" ? "Disponible" : "No disponible"}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-bold text-zinc-400 transition hover:text-white"
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}