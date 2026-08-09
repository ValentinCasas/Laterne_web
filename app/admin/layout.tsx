import Link from "next/link";
import { requireSession } from "@/lib/auth";

const links = [
  ["/admin", "Resumen"],
  ["/admin/productos", "Productos"],
  ["/admin/categorias", "Categorías"],
  ["/admin/eventos", "Eventos"],
  ["/admin/horarios", "Horarios"],
  ["/admin/testimonios", "Testimonios"],
  ["/admin/negocio", "Negocio"],
  ["/admin/usuarios", "Usuarios"],
] as const;

/** @summary Protege y organiza la estructura compartida de las pantallas administrativas. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return (
    <div className="shell grid gap-8 py-8 lg:grid-cols-[220px_1fr]">
      <aside className="card h-fit p-4">
        <p className="mb-4 px-3 text-xs font-bold uppercase tracking-widest text-pink-400">Administración</p>
        <nav className="flex flex-col gap-1">
          {links.map(([href, label]) => (
            <Link className="rounded-lg px-3 py-2 hover:bg-white/10" href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <form action="/api/auth/logout" method="post" className="mt-5 border-t border-white/10 pt-4">
          <button className="w-full rounded-lg px-3 py-2 text-left text-red-300 hover:bg-red-500/10">
            Cerrar sesión
          </button>
        </form>
      </aside>
      <main>{children}</main>
    </div>
  );
}
