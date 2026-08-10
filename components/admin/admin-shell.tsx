"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { NotificationCenter } from "@/components/admin/notification-center";

const links = [
  { href: "/admin/onboarding", label: "Puesta en marcha", icon: "OK", permission: "admin.access" },
  { href: "/admin", label: "Resumen", icon: "IN", permission: "admin.access" },
  { href: "/admin/productos", label: "Productos", icon: "PR", permission: "product.manage" },
  { href: "/admin/opciones-producto", label: "Variantes y extras", icon: "VX", permission: "product.manage" },
  { href: "/admin/categorias", label: "Categorías", icon: "CA", permission: "category.manage" },
  { href: "/admin/eventos", label: "Eventos", icon: "EV", permission: "event.manage" },
  { href: "/admin/promociones", label: "Promociones", icon: "PM", permission: "promotion.manage" },
  { href: "/admin/reservas", label: "Reservas", icon: "RS", permission: "reservation.manage" },
  { href: "/admin/pedidos", label: "Pedidos", icon: "PE", permission: "order.manage" },
  { href: "/admin/facturacion", label: "Facturación", icon: "FC", permission: "order.manage" },
  { href: "/admin/inventario", label: "Inventario", icon: "ST", permission: "product.manage" },
  { href: "/admin/mesas", label: "Mesas y QR", icon: "QR", permission: "table.manage" },
  { href: "/admin/sucursales", label: "Sucursales", icon: "SU", permission: "business.manage" },
  {
    href: "/admin/clientes-frecuentes",
    label: "Clientes frecuentes",
    icon: "CF",
    permission: "customer.manage",
  },
  { href: "/admin/estadisticas", label: "Estadísticas", icon: "AN", permission: "analytics.read" },
  { href: "/admin/notificaciones", label: "Notificaciones", icon: "NO", permission: "notification.manage" },
  { href: "/admin/horarios", label: "Horarios", icon: "HO", permission: "hours.manage" },
  {
    href: "/admin/testimonios",
    label: "Testimonios",
    icon: "TE",
    permission: "testimonial.moderate",
  },
  { href: "/admin/negocio", label: "Negocio", icon: "NE", permission: "business.manage" },
  { href: "/admin/marca", label: "Marca", icon: "BR", permission: "brand.manage" },
  { href: "/admin/seo", label: "SEO", icon: "SE", permission: "business.manage" },
  { href: "/admin/redirecciones", label: "Redirecciones", icon: "RD", permission: "business.manage" },
  { href: "/admin/integraciones", label: "Integraciones", icon: "IG", permission: "business.manage" },
  { href: "/admin/legales", label: "Páginas legales", icon: "LG", permission: "content.manage" },
  { href: "/admin/ayuda", label: "Centro de ayuda", icon: "AY", permission: "content.manage" },
  { href: "/admin/soporte", label: "Soporte", icon: "SO", permission: "support.manage" },
  { href: "/admin/casos", label: "Casos de éxito", icon: "CX", permission: "content.manage" },
  { href: "/admin/usuarios", label: "Usuarios", icon: "US", permission: "user.manage" },
  { href: "/admin/planes", label: "Planes", icon: "PL", permission: "plan.manage" },
  { href: "/admin/oportunidades", label: "Oportunidades", icon: "OP", permission: "lead.manage" },
  { href: "/admin/auditoria", label: "Auditoría", icon: "AU", permission: "audit.read" },
  { href: "/admin/errores", label: "Registro de errores", icon: "ER", permission: "audit.read" },
  { href: "/admin/datos", label: "Importar / exportar", icon: "DT", permission: "admin.access" },
  { href: "/admin/archivos", label: "Archivos", icon: "MD", permission: "media.manage" },
  { href: "/admin/cuenta", label: "Mi cuenta", icon: "SE", permission: "admin.access" },
] as const;

/** @summary Determina si un enlace corresponde a la sección administrativa visible. */
function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

/** @summary Organiza la navegación administrativa y su contenido con un diseño adaptable. */
export function AdminShell({
  children,
  permissions,
  isSuperAdmin = false,
}: {
  children: React.ReactNode;
  permissions: string[];
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const accessibleLinks = useMemo(
    () => links.filter((link) => permissions.includes(link.permission)),
    [permissions],
  );
  const commandLinks = accessibleLinks.filter((link) =>
    link.label.toLocaleLowerCase("es").includes(commandQuery.trim().toLocaleLowerCase("es")),
  );

  useEffect(() => {
    /** @summary Abre comandos rápidos con Ctrl o Cmd más K y los cierra con Escape. */
    function keyboardShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("es") === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", keyboardShortcut);
    return () => window.removeEventListener("keydown", keyboardShortcut);
  }, []);

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
            {accessibleLinks.map(({ href, label, icon }) => {
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
            {isSuperAdmin && (
              <Link
                className="group flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-bold text-amber-300 hover:bg-amber-500/10 lg:w-full"
                href="/superadmin"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-[10px] font-black">
                  SA
                </span>
                Plataforma
              </Link>
            )}
            <button
              className="flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-red-300 hover:bg-red-500/10 lg:hidden"
              onClick={logout}
              type="button"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10">→</span>
              Salir
            </button>
          </nav>

          <div className="border-t border-white/10 p-3 print:hidden">
            <button
              className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10"
              onClick={() => setCommandOpen(true)}
              type="button"
            >
              <span>Buscar o ir a…</span>
              <kbd className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-500">
                Ctrl K
              </kbd>
            </button>
          </div>

          {permissions.includes("notification.manage") && <NotificationCenter />}

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
      {commandOpen && (
        <div
          className="fixed inset-0 z-[150] grid place-items-start bg-black/80 p-4 pt-[12vh] backdrop-blur"
          onClick={() => setCommandOpen(false)}
        >
          <section
            className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Comandos rápidos"
          >
            <label className="block border-b border-white/10 p-4">
              <span className="sr-only">Buscar una sección</span>
              <input
                className="w-full bg-transparent text-xl font-bold outline-none"
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Buscar sección…"
                autoFocus
              />
            </label>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {commandLinks.map((link) => (
                <Link
                  className="flex items-center gap-3 rounded-2xl p-3 hover:bg-white/5"
                  href={link.href}
                  key={link.href}
                  onClick={() => {
                    setCommandOpen(false);
                    setCommandQuery("");
                  }}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-pink-500/10 text-[10px] font-black text-pink-300">
                    {link.icon}
                  </span>
                  <strong>{link.label}</strong>
                </Link>
              ))}
              {!commandLinks.length && (
                <p className="p-8 text-center text-sm text-zinc-500">No encontramos esa sección.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
