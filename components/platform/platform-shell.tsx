"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups = [
  { label: "Inicio", links: [["/platform", "Resumen"]] },
  {
    label: "Clientes",
    links: [
      ["/platform/clientes", "Clientes"],
      ["/platform/clientes/nuevo", "Nuevo cliente"],
      ["/platform/oportunidades", "Oportunidades"],
    ],
  },
  {
    label: "Facturación",
    links: [
      ["/platform/suscripciones", "Suscripciones"],
      ["/platform/pagos", "Pagos"],
      ["/platform/planes", "Planes y capacidades"],
    ],
  },
  {
    label: "Operación",
    links: [
      ["/platform/dominios", "Dominios"],
      ["/platform/uso", "Uso y límites"],
      ["/platform/soporte", "Soporte SaaS"],
    ],
  },
  {
    label: "Sistema",
    links: [
      ["/platform/auditoria", "Auditoría"],
      ["/platform/configuracion", "Configuración"],
    ],
  },
] as const;

/**
 * @summary Renderiza la navegación adaptable del panel de plataforma.
 */
function PlatformNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="mc-sidebar-nav" aria-label="Navegación de MenuClick Platform">
      {groups.map((group) => (
        <section key={group.label}>
          <p className="mc-sidebar-label">{group.label}</p>
          {group.links.map(([href, label]) => {
            const active = href === "/platform" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`mc-sidebar-link ${active ? "is-active" : ""}`}
                href={href}
                key={href}
                onClick={onNavigate}
              >
                {label}
              </Link>
            );
          })}
        </section>
      ))}
    </nav>
  );
}

/** @summary Sidebar interna de MenuClick Platform, separada de la navegación comercial. */
export function PlatformShell({
  children,
  name,
  logoUrl,
}: {
  children: React.ReactNode;
  name: string;
  logoUrl: string | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="mc-platform-shell min-h-screen">
      <header className="mc-platform-topbar">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-4 px-5">
          <Link href="/platform" className="flex items-center gap-3">
            <span className="mc-logo-mark">{logoUrl ? <img src={logoUrl} alt="" /> : "M"}</span>
            <span>
              <strong className="block text-lg">{name}</strong>
              <small className="block text-xs text-[var(--mc-text-muted)]">PLATFORM</small>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <a className="mc-topbar-link hidden sm:inline-flex" href="/" target="_blank" rel="noreferrer">
              Ver sitio MenuClick ↗
            </a>
            <form action="/api/platform/auth/logout" method="post">
              <button className="mc-topbar-link" type="submit">
                Salir
              </button>
            </form>
            <button
              className="mc-menu-trigger"
              aria-controls="mc-platform-drawer"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((open) => !open)}
              type="button"
            >
              {mobileOpen ? "×" : "☰"}
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-6 px-5 py-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:py-8">
        <aside className="mc-platform-sidebar">
          <div className="mc-sidebar-heading">
            <span className="mc-sidebar-kicker">{name}</span>
            <strong>PLATAFORMA</strong>
          </div>
          <PlatformNavigation />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
      {mobileOpen && (
        <div className="mc-drawer-backdrop" onClick={() => setMobileOpen(false)}>
          <aside
            className="mc-platform-drawer"
            id="mc-platform-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <strong>{name} Platform</strong>
              <button className="mc-menu-trigger" onClick={() => setMobileOpen(false)} type="button">
                ×
              </button>
            </div>
            <PlatformNavigation onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
