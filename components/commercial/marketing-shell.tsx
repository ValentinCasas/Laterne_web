import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MarketingNavbar } from "@/components/commercial/marketing-navbar";

/** @summary Chrome comercial único de MenuClick, con branding global de Platform. */
export async function MarketingShell({ children }: { children: React.ReactNode }) {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 1 }, select: { name: true, logoUrl: true } });
  const name = settings?.name || "MenuClick";
  return <div className="marketing-theme min-h-screen"><MarketingNavbar name={name} logoUrl={settings?.logoUrl ?? null} />{children}<footer className="mc-marketing-footer"><div className="mc-marketing-footer-grid"><div><Link className="mc-brand-lockup" href="/">{name}<b>.</b></Link><p>La operación digital para negocios gastronómicos que quieren crecer sin perder el control.</p></div><div><h2>Producto</h2><Link href="/funcionalidades">Funcionalidades</Link><Link href="/multi-sucursal">Multi-sucursal</Link><Link href="/planes">Planes</Link></div><div><h2>Empresa</h2><Link href="/para-negocios">Para negocios</Link><Link href="/clientes">Clientes</Link><Link href="/solicitar-demo">Contacto</Link></div><div><h2>Acceso</h2><Link href="/login">Ingresar</Link><Link href="/legal">Privacidad y términos</Link></div></div><p className="mc-marketing-copyright">© {new Date().getFullYear()} {name}. Plataforma para gastronomía.</p></footer></div>;
}
