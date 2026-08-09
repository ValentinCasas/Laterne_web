"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Swal from "sweetalert2";

const links = [
  { href: "/admin", label: "Resumen", icon: "IN" },
  { href: "/admin/productos", label: "Productos", icon: "PR" },
  { href: "/admin/categorias", label: "Categorías", icon: "CA" },
  { href: "/admin/eventos", label: "Eventos", icon: "EV" },
  { href: "/admin/horarios", label: "Horarios", icon: "HO" },
  { href: "/admin/testimonios", label: "Testimonios", icon: "TE" },
  { href: "/admin/negocio", label: "Negocio", icon: "NE" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "US" },
] as const;

/** @summary Determina si un enlace corresponde a la sección administrativa visible. */
function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

/** @summary Organiza la navegación administrativa y su contenido con un diseño adaptable. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  /** @summary Confirma el cierre de sesión y devuelve al usuario a la pantalla de acceso. */
  async function logout() {
    const result = await Swal.fire({
      title: "¿Cerrar sesión?",
      text: "Vas a salir del panel de administración.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });

    if (!result.isConfirmed) return;
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,.12),transparent_30%),#09090b]">
      <div className="shell grid gap-5 py-5 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-8 lg:py-8">
        <aside className="sticky top-20 z-40 h-fit overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="hidden border-b border-white/10 p-6 lg:block">
            <p className="text-xs font-black uppercase tracking-[.28em] text-pink-400">Laterne Studio</p>
            <h2 className="mt-2 text-2xl font-black">Administración</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Gestioná el contenido que ven tus clientes.
            </p>
          </div>

          <nav
            className="flex gap-2 overflow-x-auto p-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:p-3"
            aria-label="Secciones administrativas"
          >
            {links.map(({ href, label, icon }) => {
              const active = isActivePath(pathname, href);
              return (
                <Link
                  className={`group flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold transition lg:w-full ${
                    active
                      ? "bg-pink-500 text-white shadow-lg shadow-pink-950/40"
                      : "text-zinc-400 hover:bg-white/5 hover:text-white"
                  }`}
                  href={href}
                  key={href}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-black tracking-wider ${
                      active ? "bg-white/20" : "bg-white/5 text-pink-300 group-hover:bg-pink-500/15"
                    }`}
                  >
                    {icon}
                  </span>
                  <span>{label}</span>
                </Link>
              );
            })}
            <button
              className="flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/10 lg:hidden"
              onClick={logout}
              type="button"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10">→</span>
              Salir
            </button>
          </nav>

          <div className="hidden border-t border-white/10 p-3 lg:block">
            <button
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-red-300 hover:bg-red-500/10"
              onClick={logout}
              type="button"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10">→</span>
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
