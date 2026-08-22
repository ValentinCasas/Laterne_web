"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/admin/ui/icons";
import { parseCanonicalPath } from "@/lib/routes";

type DriverNavItem = { href: Route; label: string; icon: IconName; logicalPath: string; badge?: number };

/** @summary Navegación inferior mobile con estado activo canónico, badges y safe area. */
export function DriverNavigation({ items }: { items: DriverNavItem[] }) {
  const pathname = usePathname();
  const logicalPath = parseCanonicalPath(pathname).logicalPath;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl" aria-label="Navegación del repartidor">
      <div className="mx-auto flex max-w-3xl px-2 pb-[max(env(safe-area-inset-bottom),.35rem)] pt-1.5">
        {items.map((item) => {
          const active = item.logicalPath === "/driver" ? logicalPath === "/driver" : logicalPath.startsWith(item.logicalPath);
          return (
            <Link key={item.href} href={item.href} aria-label={item.label} aria-current={active ? "page" : undefined} className={`group flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition-all duration-200 ${active ? "text-white" : "text-zinc-500 hover:text-zinc-200"}`}>
              <span className={`relative grid h-8 min-w-10 place-items-center rounded-full px-3 transition-all duration-200 ${active ? "-translate-y-0.5 bg-pink-500/15 text-pink-300" : "group-hover:bg-white/5"}`}>
                <Icon name={item.icon} className="h-5 w-5" />
                {Boolean(item.badge) && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-orange-500 px-1 text-[9px] leading-none text-white ring-2 ring-zinc-950">{item.badge! > 99 ? "99+" : item.badge}</span>}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
