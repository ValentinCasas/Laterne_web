"use client";

import { useEffect, useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/admin/ui/icons";
import { parseCanonicalPath } from "@/lib/routes";
import { scopedFetch } from "@/lib/client-routing";

type DriverNavItem = { href: Route; label: string; icon: IconName; logicalPath: string; badge?: number };

/** @summary Navegación inferior premium con estado canónico, badges animados y safe area. */
export function DriverNavigation({ items, activeDeliveries: initialActive }: { items: DriverNavItem[]; activeDeliveries: number; todayCount: number }) {
  const pathname = usePathname();
  const logicalPath = parseCanonicalPath(pathname).logicalPath;
  const [activeDeliveries, setActiveDeliveries] = useState(initialActive);

  /* ── Fetch badge data ── */
  useEffect(() => {
    let disposed = false;
    async function fetchBadges() {
      const res = await scopedFetch("/api/driver/routes", { cache: "no-store" }).catch(() => null);
      if (!res?.ok || disposed) return;
      const body = (await res.json().catch(() => ({}))) as { activeRoute?: { deliveries?: Array<{ status: string }> }; history?: unknown[] };
      if (disposed) return;
      if (body.activeRoute?.deliveries) {
        setActiveDeliveries(body.activeRoute.deliveries.filter((d) => d.status !== "DELIVERED").length);
      }
    }
    fetchBadges();
    const timer = window.setInterval(() => void fetchBadges(), 30_000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[.06] bg-zinc-950/95 backdrop-blur-2xl" aria-label="Navegación del repartidor">
      <div className="mx-auto flex max-w-3xl items-stretch px-2 pb-[max(env(safe-area-inset-bottom),.35rem)] pt-1">
        {items.map((item) => {
          const active = item.logicalPath === "/driver" ? logicalPath === "/driver" : logicalPath.startsWith(item.logicalPath);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-black transition-all duration-200 ${active ? "text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              <span className={`relative grid h-9 min-w-11 place-items-center rounded-xl px-3 transition-all duration-200 ${active ? "-translate-y-0.5 bg-gradient-to-b from-pink-500/20 to-pink-500/5 text-pink-300 shadow-lg shadow-pink-500/10" : "group-hover:bg-white/5"}`}>
                <Icon name={item.icon} className="h-5 w-5" />
                {Boolean(item.badge) && item.badge! > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex min-h-[18px] items-center justify-center rounded-full bg-orange-500 px-1.5 text-[9px] font-black leading-none text-white shadow-lg shadow-orange-500/30 ring-2 ring-zinc-950">
                    {item.badge! > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className={`text-[10px] transition-colors ${active ? "text-zinc-200" : ""}`}>{item.label}</span>
              {active && <span className="absolute inset-x-4 -bottom-1.5 h-0.5 rounded-full bg-gradient-to-r from-transparent via-pink-500 to-transparent" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** @summary Construye los items de navegación del repartidor con las rutas canónicas apropiadas. */
export function buildDriverNavItems(opts: { tenantSlug: string; tenantGuid?: string; activeDeliveries: number; todayCompleted: number }): DriverNavItem[] {
  const base = opts.tenantGuid
    ? (path: string) => `/t/${opts.tenantGuid}/${opts.tenantSlug}/driver${path === "/" ? "" : path}` as Route
    : (path: string) => `/t/${opts.tenantSlug}/driver${path === "/" ? "" : path}` as Route;

  return [
    { href: base("/"), label: "Operación", icon: "grid" as IconName, logicalPath: "/driver" },
    { href: base("/recorridos"), label: "Recorridos", icon: "truck" as IconName, logicalPath: "/driver/recorridos" },
    { href: base("/entregas"), label: "Historial", icon: "package" as IconName, logicalPath: "/driver/entregas", badge: opts.todayCompleted || undefined },
    { href: base("/incidencias"), label: "Incidencias", icon: "warning" as IconName, logicalPath: "/driver/incidencias", badge: opts.activeDeliveries || undefined },
  ];
}
