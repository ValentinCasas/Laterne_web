import Link from "next/link";

const links = [
  ["/superadmin", "Resumen"],
  ["/superadmin/clientes", "Clientes"],
  ["/superadmin/suscripciones", "Suscripciones"],
  ["/superadmin/pagos", "Pagos"],
  ["/superadmin/planes", "Planes y capacidades"],
  ["/superadmin/dominios", "Dominios"],
  ["/superadmin/uso", "Uso y límites"],
  ["/superadmin/soporte", "Soporte SaaS"],
  ["/superadmin/auditoria", "Auditoría global"],
  ["/superadmin/configuracion", "Configuración"],
] as const;

export function PlatformShell({ children }: { children: React.ReactNode }) {
  return <div className="platform-theme min-h-screen bg-[#0b0d12] text-white"><header className="border-b border-white/10 bg-[#11151e]/95 backdrop-blur"><div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-6 px-5 py-4"><Link href="/superadmin" className="shrink-0"><span className="block text-xs font-black uppercase tracking-[.28em] text-amber-300">MenuClick</span><strong className="mt-1 block text-xl">Platform</strong></Link><nav className="flex max-w-[calc(100vw-12rem)] gap-1 overflow-x-auto" aria-label="Navegación de MenuClick Platform">{links.map(([href, label]) => <Link className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10 hover:text-white" href={href} key={href}>{label}</Link>)}</nav><form action="/api/auth/logout" method="post"><button className="hidden rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-white/10 sm:block" type="submit">Salir</button></form></div></header><main className="mx-auto w-full max-w-[1440px] px-5 py-8 sm:py-10">{children}</main></div>;
}
