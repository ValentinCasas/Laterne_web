"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

const productLinks = [["/funcionalidades", "Funcionalidades", "Carta, pedidos, reservas e inventario."], ["/multi-sucursal", "Multi-sucursal", "Crecer sin perder el control."]] as Array<[Route, string, string]>;
const solutionLinks = [["/para-negocios", "Para negocios", "Una base para gastronomía real."], ["/clientes", "Clientes", "Casos públicos autorizados."]] as Array<[Route, string, string]>;

function isActive(pathname: string, href: string) { return pathname === href || pathname.startsWith(`${href}/`); }

function DesktopMenuGroup({ label, links, active }: { label: string; links: Array<[Route, string, string]>; active: boolean }) {
  return <details className={`mc-menu-group ${active ? "is-current" : ""}`}><summary>{label}<span className="mc-nav-chevron" aria-hidden="true" /></summary><div className="mc-dropdown">{links.map(([href, title, description]) => <Link href={href} key={href}><strong>{title}</strong><small>{description}</small></Link>)}</div></details>;
}

/** @summary Navbar comercial compacta con dropdowns alineados y navegación mobile accesible. */
export function MarketingNavbar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return <header className="mc-marketing-header"><nav className="mc-marketing-nav" aria-label="Navegación comercial MenuClick"><Link className="mc-brand-lockup" href="/" onClick={() => setMobileOpen(false)}><span className="mc-logo-mark">{logoUrl ? <Image src={logoUrl} alt="" width={36} height={36} /> : "M"}</span><span>{name}<b>.</b></span></Link><div className="mc-desktop-menu"><DesktopMenuGroup label="Producto" links={productLinks} active={isActive(pathname, "/funcionalidades") || isActive(pathname, "/multi-sucursal")} /><DesktopMenuGroup label="Soluciones" links={solutionLinks} active={isActive(pathname, "/para-negocios") || isActive(pathname, "/clientes")} /><Link className={isActive(pathname, "/planes") ? "is-current" : ""} href="/planes">Planes</Link></div><div className="mc-nav-actions"><Link className="mc-nav-login" href="/login">Ingresar</Link><Link className="mc-button mc-nav-demo" href="/solicitar-demo">Solicitar demo</Link></div><button className="mc-menu-trigger mc-mobile-trigger" aria-controls="mc-marketing-drawer" aria-expanded={mobileOpen} aria-label={mobileOpen ? "Cerrar navegación" : "Abrir navegación"} onClick={() => setMobileOpen((value) => !value)} type="button">{mobileOpen ? "×" : "☰"}</button></nav>{mobileOpen && <div className="mc-mobile-drawer" id="mc-marketing-drawer"><div className="mc-mobile-group"><strong>Producto</strong>{productLinks.map(([href, label]) => <Link href={href} key={href} onClick={() => setMobileOpen(false)}>{label}</Link>)}</div><div className="mc-mobile-group"><strong>Soluciones</strong>{solutionLinks.map(([href, label]) => <Link href={href} key={href} onClick={() => setMobileOpen(false)}>{label}</Link>)}</div><Link href="/planes" onClick={() => setMobileOpen(false)}>Planes</Link><Link href="/login" onClick={() => setMobileOpen(false)}>Ingresar</Link><Link className="mc-button" href="/solicitar-demo" onClick={() => setMobileOpen(false)}>Solicitar demo</Link></div>}</header>;
}
