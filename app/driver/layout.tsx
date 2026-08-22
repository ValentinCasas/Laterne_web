import type { ReactNode } from "react";
import Link from "next/link";
import { requireDriver } from "@/lib/auth";
import { tenantDriverGuidPath } from "@/lib/routes";
import { prisma } from "@/lib/prisma";
import { DriverNavigation } from "@/components/driver/driver-navigation";
import { UserAvatar } from "@/components/admin/ui/avatar";
import { DriverAvailabilityPill } from "@/components/driver/availability-pill";

export const dynamic = "force-dynamic";

/** @summary Resuelve la imagen guardada del usuario sin invocar utilidades client-side. */
function driverAvatarUrl(imageUrl?: string | null) {
  const value = imageUrl?.trim();
  if (!value || value === "avatar_profile_default.png") return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/images/images_profile/${value}`;
}

/** @summary Shell mobile-first de la app del repartidor con identidad, sucursal y navegación operativa. */
export default async function DriverLayout({ children }: { children: ReactNode }) {
  const context = await requireDriver();
  const profile = await prisma.driverProfile.findFirst({
    where: { tenantId: context.tenant.id, userId: context.session.userId },
    select: {
      id: true,
      name: true,
      status: true,
      active: true,
      branches: { select: { branch: { select: { id: true, name: true } } } },
    },
  });
  const [activeDeliveries, activeIncidents] = profile
    ? await Promise.all([
        prisma.orderDelivery.count({ where: { tenantId: context.tenant.id, driverProfileId: profile.id, status: { in: ["ASSIGNED", "PICKED_UP", "ON_THE_WAY"] } } }),
        prisma.driverIncident.count({ where: { tenantId: context.tenant.id, driverId: profile.id, resolved: false } }),
      ])
    : [0, 0];

  const driverHome = tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug);
  const nav = [
    { href: driverHome, logicalPath: "/driver", label: "Entregas", icon: "truck" as const, badge: activeDeliveries },
    { href: tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug, "/entregas"), logicalPath: "/driver/entregas", label: "Historial", icon: "file" as const },
    { href: tenantDriverGuidPath(context.tenant.publicGuid, context.tenant.slug, "/incidencias"), logicalPath: "/driver/incidencias", label: "Incidencias", icon: "warning" as const, badge: activeIncidents },
  ];
  const available = Boolean(profile?.active && profile.status === "AVAILABLE");
  const rawBranchName = profile?.branches[0]?.branch.name ?? context.branches[0]?.name ?? "Sin sucursal";
  const branchName = rawBranchName.toLocaleLowerCase("es").startsWith(`${context.tenant.name.toLocaleLowerCase("es")} · `)
    ? rawBranchName.slice(context.tenant.name.length + 3)
    : rawBranchName;
  const displayName = profile?.name ?? context.user.name;

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-white">
      <header data-driver-navbar="true" className="fixed inset-x-0 top-0 z-40 border-b border-white/10 bg-zinc-950/88 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <Link href={driverHome} className="flex min-w-0 items-center gap-3">
            <UserAvatar name={displayName} src={driverAvatarUrl(context.user.imageUrl)} size="md" status={available ? "online" : "away"} className="ring-1 ring-white/10" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-black leading-tight">{displayName}</span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-400">{context.tenant.name} · {branchName}</span>
            </span>
          </Link>
          {profile && <DriverAvailabilityPill initialAvailable={available} />}
        </div>
      </header>
      <div className="h-16 shrink-0" aria-hidden="true" />
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-28 pt-4 sm:px-5 lg:pb-24 lg:pt-6">{children}</main>
      <DriverNavigation items={nav} />
    </div>
  );
}
