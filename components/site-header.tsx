"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseCanonicalPath, publicHrefForVisiblePath } from "@/lib/routes";

const navGroups = [
  {
    id: "contenido",
    label: "Contenido",
    items: [
      ["/carta", "Carta"],
      ["/#eventos", "Eventos"],
      ["/#horarios", "Horarios"],
      ["/promociones", "Promociones"],
    ] as const,
  },
  {
    id: "gestion",
    label: "Gestión",
    items: [
      ["/reservas", "Reservas"],
      ["/fidelidad", "Puntos"],
    ] as const,
  },
] as const;

const directLinks = [["/ayuda", "Ayuda"] as const];

function getGroupId(pathname: string | null) {
  if (!pathname) return null;
  for (const group of navGroups) {
    if (group.items.some(([href]) => href === pathname || (href.startsWith("/#") && pathname === "/"))) {
      return group.id;
    }
  }
  return null;
}

/** @summary Renderiza la navegación principal adaptable a escritorio y dispositivos móviles. */
export function SiteHeader({
  brandName = "MenuClick",
  logoUrl,
  tenantSlug,
  branchSlug,
}: {
  brandName?: string;
  logoUrl?: string | null;
  tenantSlug: string;
  branchSlug?: string;
}) {
  const pathname = usePathname();
  const routeContext = parseCanonicalPath(pathname);
  const logicalPath = routeContext.surface === "tenant-public"
    ? routeContext.logicalPath.replace(/^\/s\/[^/]+(?=\/|$)/, "") || "/"
    : pathname.replace(/^\/s\/[^/]+(?=\/|$)/, "") || "/";
  const tenantHref = (href: string) =>
    publicHrefForVisiblePath(pathname, tenantSlug, href, routeContext.branchSlug ?? branchSlug);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileGroupOpen, setMobileGroupOpen] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const activeGroup = getGroupId(logicalPath);

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setOpenGroup(null);
    setMobileGroupOpen(null);
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
        setMobileGroupOpen(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-md">
      <nav
        ref={headerRef}
        className="shell flex h-16 items-center justify-between gap-4 px-2"
        aria-label="Navegación principal"
      >
        <Link
          href={tenantHref("/")}
          className="flex items-center gap-2 text-2xl font-black tracking-tight text-pink-400 transition hover:text-white"
        >
          {logoUrl && (
            <Image src={logoUrl} alt={`Logo de ${brandName}`} width={36} height={36} className="h-9 w-auto object-contain" />
          )}
          <span>
            {brandName}
            <span className="text-white">&.</span>
          </span>
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          <div className="flex-1 flex items-center justify-center gap-2">
            {navGroups.map((group) => (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  className={`flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
                    activeGroup === group.id ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => setOpenGroup(openGroup === group.id ? null : group.id)}
                  aria-expanded={openGroup === group.id}
                  aria-haspopup="menu"
                  aria-controls={`${group.id}-desktop-menu`}
                >
                  {group.label}
                  <span className="text-xs">▾</span>
                </button>

                <div
                  id={`${group.id}-desktop-menu`}
                  className={`absolute right-0 top-full z-30 mt-2 min-w-[14rem] overflow-hidden rounded-3xl border border-white/10 bg-[#09090b]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl ${
                    openGroup === group.id ? "block" : "hidden"
                  }`}
                  role="menu"
                >
                  <ul className="space-y-2">
                    {group.items.map(([href, label]) => (
                      <li key={href}>
                        <Link
                          href={tenantHref(href)}
                          className="block rounded-2xl px-3 py-2 text-sm text-white/90 transition hover:bg-white/5 hover:text-white"
                          role="menuitem"
                          onClick={() => setOpenGroup(null)}
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {directLinks.map(([href, label]) => (
              <Link
                key={href}
                href={tenantHref(href)}
                className="rounded-full px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-white transition hover:bg-white/10 lg:hidden"
          onClick={() => setMobileOpen((current) => !current)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"}
        >
          <span>{mobileOpen ? "×" : "☰"}</span>
        </button>
      </nav>

      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div
            id="mobile-navigation"
            className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,88vw)] flex-col border-l border-white/10 bg-[#09090b] shadow-2xl shadow-black/50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
              <Link href={tenantHref("/")} className="flex items-center gap-2 text-xl font-black tracking-tight text-pink-400 transition hover:text-white">
                {logoUrl && (
                  <Image src={logoUrl} alt={`Logo de ${brandName}`} width={30} height={30} className="h-8 w-auto object-contain" />
                )}
                <span>
                  {brandName}
                  <span className="text-white">&.</span>
                </span>
              </Link>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-white transition hover:bg-white/10"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar navegación"
              >
                ×
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={tenantHref("/carta")}
                  onClick={() => setMobileOpen(false)}
                  className="btn !px-3 !py-2.5 text-center text-sm"
                >
                  Ver carta
                </Link>
                <Link
                  href={tenantHref("/reservas")}
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-secondary !px-3 !py-2.5 text-center text-sm"
                >
                  Reservar mesa
                </Link>
              </div>

              {navGroups.map((group) => (
                <div key={group.id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/10"
                    onClick={() => setMobileGroupOpen(mobileGroupOpen === group.id ? null : group.id)}
                    aria-expanded={mobileGroupOpen === group.id}
                    aria-controls={`${group.id}-mobile-panel`}
                  >
                    <span>{group.label}</span>
                    <span className="text-xs">{mobileGroupOpen === group.id ? "▴" : "▾"}</span>
                  </button>
                  <ul
                    id={`${group.id}-mobile-panel`}
                    className={`${mobileGroupOpen === group.id ? "grid" : "hidden"} gap-2 border-t border-white/10 px-4 pb-4 pt-2`}
                  >
                    {group.items.map(([href, label]) => (
                      <li key={href}>
                        <Link
                          href={tenantHref(href)}
                          onClick={() => {
                            setMobileOpen(false);
                            setMobileGroupOpen(null);
                          }}
                          className="block rounded-2xl px-3 py-3 text-sm text-white/90 transition hover:bg-white/10 hover:text-white"
                        >
                          {label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="space-y-2 rounded-3xl border border-white/10 bg-white/5 p-3">
                {directLinks.map(([href, label]) => (
                  <Link
                    key={href}
                    href={tenantHref(href)}
                    onClick={() => setMobileOpen(false)}
                    className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10 hover:text-white"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </header>
  );
}
