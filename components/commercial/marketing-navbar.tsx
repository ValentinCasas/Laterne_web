"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useState } from "react";

const productLinks = [["/funcionalidades", "Funcionalidades", "Carta, pedidos, reservas e inventario."], ["/multi-sucursal", "Multi-sucursal", "Crecer sin perder el control."]] as Array<[Route, string, string]>;
const solutionLinks = [["/para-negocios", "Para negocios", "Una base para gastronomía real."], ["/clientes", "Clientes", "Casos públicos autorizados."]] as Array<[Route, string, string]>;

function isActive(pathname: string, href: string) { return pathname === href || pathname.startsWith(`${href}/`); }

/** @summary Navbar comercial con dropdowns compactos, estado activo y drawer accesible en mobile. */
export function MarketingNavbar({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const toggle = () => setOpenPath((current) => current === pathname ? null : pathname);
  return <header className="mc-marketing-header"><nav className="mc-marketing-nav" aria-label="Navegación comercial MenuClick"><Link className="mc-brand-lockup" href="/"><span className="mc-logo-mark">{logoUrl ? <Image src={logoUrl} alt="" width={36} height={36} /> : "M"}</span><span>{name}<b>.</b></span></Link><div className="mc-desktop-menu"><details className={isActive(pathname, "/funcionalidades") || isActive(pathname, "/multi-sucursal") ? "is-current" : ""}><summary>Producto <span>⌄</span></summary><div className="mc-dropdown">{productLinks.map(([href, label, description]) => <Link href={href} key={href}><strong>{label}</strong><small>{description}</small></Link>)}</div></details><details className={isActive(pathname, "/para-negocios") || isActive(pathname, "/clientes") ? "is-current" : ""}><summary>Soluciones <span>⌄</span></summary><div className="mc-dropdown">{solutionLinks.map(([href, label, description]) => <Link href={href} key={href}><strong>{label}</strong><small>{description}</small></Link>)}</div></details><Link className={isActive(pathname, "/planes") ? "is-current" : ""} href="/planes">Planes</Link></div><div className="mc-nav-actions"><Link className="mc-nav-login" href="/login">Ingresar</Link><Link className="mc-button mc-nav-demo" href="/solicitar-demo">Solicitar demo</Link></div><button className="mc-menu-trigger mc-mobile-trigger" aria-controls="mc-marketing-drawer" aria-expanded={open} onClick={toggle} type="button">{open ? "×" : "☰"}</button></nav>{open && <div className="mc-mobile-drawer" id="mc-marketing-drawer"><div className="mc-mobile-group"><strong>Producto</strong>{productLinks.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</div><div className="mc-mobile-group"><strong>Soluciones</strong>{solutionLinks.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</div><Link href="/planes">Planes</Link><Link href="/login">Ingresar</Link><Link className="mc-button" href="/solicitar-demo">Solicitar demo</Link></div>}</header>;
}
