"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/admin/ui/icons";
import { createPortal } from "react-dom";
import { parseCanonicalPath, publicHrefForVisiblePath } from "@/lib/routes";

/** @summary Crea un efecto ripple sutil desde el punto de click usando el accent del tenant. */
function useRipple() {
  return useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 500);
  }, []);
}

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
const mobileLinks: ReadonlyArray<readonly [string, string]> = [
  ["/", "Inicio"],
  ...navGroups[0].items,
  ...navGroups[1].items,
  ...directLinks,
];

/**
 * @summary Obtiene un identificador estable para un grupo de navegación.
 */
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
  const logicalPath =
    routeContext.surface === "tenant-public"
      ? routeContext.logicalPath.replace(/^\/s\/[^/]+(?=\/|$)/, "") || "/"
      : pathname.replace(/^\/s\/[^/]+(?=\/|$)/, "") || "/";
  const tenantHref = (href: string) =>
    publicHrefForVisiblePath(pathname, tenantSlug, href, routeContext.branchSlug ?? branchSlug);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const ripple = useRipple();

  const activeGroup = getGroupId(logicalPath);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    /**
     * @summary Cierra la navegación móvil cuando el usuario interactúa fuera de ella.
     */
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }

    /**
     * @summary Cierra la navegación móvil al presionar Escape.
     */
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
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
    <>
    <header
      data-site-navbar="true"
      className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/95 backdrop-blur-md"
      style={{ height: "calc(4rem + var(--site-safe-area-top))" }}
    >
      <nav
        ref={headerRef}
        className="shell flex h-full items-center justify-between gap-4 px-2 pt-[var(--site-safe-area-top)]"
        aria-label="Navegación principal"
      >
        <Link
          href={tenantHref("/")}
          className="flex items-center gap-2 text-2xl font-black tracking-tight text-pink-400 transition hover:text-white"
        >
          {logoUrl && (
            <Image
              src={logoUrl}
              alt={`Logo de ${brandName}`}
              width={36}
              height={36}
              className="h-9 w-auto object-contain"
            />
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
                  className={`ripple-container flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold transition ${
                    activeGroup === group.id
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={(e) => { ripple(e); setOpenGroup(openGroup === group.id ? null : group.id); }}
                  aria-expanded={openGroup === group.id}
                  aria-haspopup="menu"
                  aria-controls={`${group.id}-desktop-menu`}
                >
                  {group.label}
                  <span className="text-xs">▾</span>
                </button>

                <div
                  id={`${group.id}-desktop-menu`}
                  className={`absolute right-0 top-full z-30 mt-2 min-w-[14rem] overflow-hidden rounded-3xl border border-white/10 bg-[#09090b]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all duration-200 ${
                    openGroup === group.id ? "opacity-100 translate-y-0 scale-100" : "pointer-events-none opacity-0 -translate-y-1 scale-[0.98]"
                  }`}
                  role="menu"
                >
                  <ul className="space-y-1.5">
                    {group.items.map(([href, label]) => (
                      <li key={href}>
                        <Link
                          href={tenantHref(href)}
                          className="ripple-container block rounded-2xl px-3 py-2.5 text-sm text-white/90 transition hover:bg-white/5 hover:text-white"
                          role="menuitem"
                          onClick={(e) => { ripple(e); setOpenGroup(null); }}
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
          <span>{mobileOpen ? <Icon name="x" className="h-5 w-5" /> : <Icon name="menu" className="h-5 w-5" />}</span>
        </button>
      </nav>

      {mobileOpen &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              id="mobile-navigation"
              className="fixed inset-y-0 right-0 z-[200] flex h-dvh w-[min(20rem,88vw)] max-w-full flex-col border-l border-white/10 bg-[#09090b] shadow-2xl shadow-black/50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de navegación"
            >
              <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 pt-[env(safe-area-inset-top)]">
                <Link
                  href={tenantHref("/")}
                  className="flex items-center gap-2 text-xl font-black tracking-tight text-pink-400 transition hover:text-white"
                >
                  {logoUrl && (
                    <Image
                      src={logoUrl}
                      alt={`Logo de ${brandName}`}
                      width={30}
                      height={30}
                      className="h-8 w-auto object-contain"
                    />
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

              <div className="flex flex-1 flex-col overflow-y-auto p-4">
                <nav className="grid gap-1" aria-label="Secciones del sitio">
                  {mobileLinks.map(([href, label]) => (
                    <Link
                      key={`${href}-${label}`}
                      href={tenantHref(href)}
                      onClick={() => setMobileOpen(false)}
                      className="ripple-container block rounded-2xl px-4 py-3 text-base font-semibold text-white/90 transition hover:bg-white/10 hover:text-white"
                      onMouseDown={ripple}
                    >
                      {label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-white/10 pt-5">
                  <Link
                    href={tenantHref("/carta")}
                    onClick={() => setMobileOpen(false)}
                    className="btn !px-3 !py-3 text-center text-sm"
                  >
                    Ver carta
                  </Link>
                  <Link
                    href={tenantHref("/reservas")}
                    onClick={() => setMobileOpen(false)}
                    className="btn btn-secondary !px-3 !py-3 text-center text-sm"
                  >
                    Reservar
                  </Link>
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </header>
    <div className="h-[var(--site-navbar-height)] shrink-0" aria-hidden="true" />
    </>
  );
}
