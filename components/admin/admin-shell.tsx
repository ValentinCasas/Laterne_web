"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { BranchSwitcher } from "@/components/admin/branch-switcher";
import { NotificationCenter } from "@/components/admin/notification-center";
import { defaultPalette, paletteCssVariables, type PaletteColors } from "@/lib/theme-palettes";
import { adminHrefForContext, isBranchAdminLogicalPath, parseCanonicalPath, platformAdminPath, tenantPublicPath } from "@/lib/routes";
import { scopedFetch } from "@/lib/client-routing";

type NavigationLink = {
  href: string;
  label: string;
  icon: string;
  permission: string;
};

type NavigationGroup = {
  id: string;
  label: string;
  icon: string;
  description: string;
  links: readonly NavigationLink[];
};

type SearchResults = {
  products: Array<{ id: number; name: string; price: string | null; status: string }>;
  customers: Array<{ id: number; name: string; email: string | null; phone: string | null; points: number }>;
  orders: Array<{
    id: number;
    reference: string;
    customerName: string;
    status: string;
    orderType: string;
    total: string | null;
    currency: string;
  }>;
  reservations: Array<{
    id: number;
    reference: string;
    customerName: string;
    status: string;
    reservationDate: string;
    reservationTime: string | null;
  }>;
};

type PaletteEntry = {
  key: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: string;
  href: Route;
  logicalHref?: string;
};

const navigationGroups = [
  {
    id: "inicio",
    label: "Inicio",
    icon: "IN",
    description: "Resumen y configuración inicial",
    links: [
      { href: "/admin", label: "Resumen", icon: "IN", permission: "admin.access" },
      {
        href: "/admin/onboarding",
        label: "Puesta en marcha",
        icon: "OK",
        permission: "admin.access",
      },
    ],
  },
  {
    id: "carta",
    label: "Carta y contenido",
    icon: "CA",
    description: "Productos y publicaciones",
    links: [
      { href: "/admin/productos", label: "Productos", icon: "PR", permission: "product.manage" },
      {
        href: "/admin/opciones-producto",
        label: "Variantes y extras",
        icon: "VX",
        permission: "product.manage",
      },
      { href: "/admin/categorias", label: "Categorías", icon: "CA", permission: "category.manage" },
      { href: "/admin/promociones", label: "Promociones", icon: "PM", permission: "promotion.manage" },
      { href: "/admin/eventos", label: "Eventos", icon: "EV", permission: "event.manage" },
      { href: "/admin/horarios", label: "Horarios", icon: "HO", permission: "hours.manage" },
      {
        href: "/admin/testimonios",
        label: "Testimonios",
        icon: "TE",
        permission: "testimonial.moderate",
      },
    ],
  },
  {
    id: "operacion",
    label: "Operación",
    icon: "OP",
    description: "Atención y funcionamiento diario",
    links: [
      { href: "/admin/pedidos", label: "Pedidos", icon: "PE", permission: "order.manage" },
      { href: "/admin/cocina", label: "Cocina", icon: "CO", permission: "order.manage" },
      { href: "/admin/reservas", label: "Reservas", icon: "RS", permission: "reservation.manage" },
      { href: "/admin/facturacion", label: "Facturación", icon: "FC", permission: "order.manage" },
      {
        href: "/admin/configuracion/comprobantes/plantillas",
        label: "Plantillas de documentos",
        icon: "PL",
        permission: "order.manage",
      },
      { href: "/admin/inventario", label: "Inventario", icon: "ST", permission: "product.manage" },
      { href: "/admin/mesas", label: "Mesas y QR", icon: "QR", permission: "table.manage" },
      { href: "/admin/sucursales", label: "Sucursales", icon: "SU", permission: "business.manage" },
      {
        href: "/admin/clientes-frecuentes",
        label: "Clientes frecuentes",
        icon: "CF",
        permission: "customer.manage",
      },
      { href: "/admin/fidelizacion", label: "Fidelización", icon: "FI", permission: "customer.manage" },
    ],
  },
  {
    id: "presencia",
    label: "Marca y presencia",
    icon: "BR",
    description: "Identidad y experiencia pública",
    links: [
      { href: "/admin/negocio", label: "Negocio", icon: "NE", permission: "business.manage" },
      { href: "/admin/marca", label: "Marca", icon: "BR", permission: "brand.manage" },
      { href: "/admin/landing", label: "Portada", icon: "LN", permission: "brand.manage" },
      { href: "/admin/carta", label: "Carta", icon: "CT", permission: "brand.manage" },
      { href: "/admin/seo", label: "SEO", icon: "SE", permission: "business.manage" },
      {
        href: "/admin/redirecciones",
        label: "Redirecciones",
        icon: "RD",
        permission: "business.manage",
      },
      {
        href: "/admin/integraciones",
        label: "Integraciones",
        icon: "IG",
        permission: "business.manage",
      },
      { href: "/admin/legales", label: "Páginas legales", icon: "LG", permission: "content.manage" },
      { href: "/admin/casos", label: "Casos de éxito", icon: "CX", permission: "content.manage" },
    ],
  },
  {
    id: "gestion",
    label: "Gestión y análisis",
    icon: "AN",
    description: "Métricas y administración",
    links: [
      { href: "/admin/estadisticas", label: "Estadísticas", icon: "AN", permission: "analytics.read" },
      {
        href: "/admin/notificaciones",
        label: "Notificaciones",
        icon: "NO",
        permission: "notification.manage",
      },
      { href: "/admin/usuarios", label: "Usuarios", icon: "US", permission: "user.manage" },
      { href: "/admin/auditoria", label: "Auditoría", icon: "AU", permission: "audit.read" },
      { href: "/admin/errores", label: "Registro de errores", icon: "ER", permission: "audit.read" },
    ],
  },
  {
    id: "herramientas",
    label: "Herramientas y ayuda",
    icon: "HE",
    description: "Archivos, datos y asistencia",
    links: [
      { href: "/admin/archivos", label: "Archivos", icon: "MD", permission: "media.manage" },
      { href: "/admin/datos", label: "Importar / exportar", icon: "DT", permission: "admin.access" },
      { href: "/admin/busqueda", label: "Búsqueda global", icon: "BS", permission: "admin.access" },
      { href: "/admin/ayuda", label: "Centro de ayuda", icon: "AY", permission: "content.manage" },
      { href: "/admin/soporte", label: "Soporte", icon: "SO", permission: "support.manage" },
      { href: "/admin/cuenta", label: "Mi cuenta", icon: "SE", permission: "admin.access" },
    ],
  },
] as const satisfies readonly NavigationGroup[];

const links: NavigationLink[] = navigationGroups.flatMap((group) => [...group.links]);

/** @summary Determina si un enlace corresponde a la sección administrativa visible. */
function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

/** @summary Convierte la URL visible canónica al path lógico que usan las definiciones del sidebar. */
function normalizedAdminPath(pathname: string) {
  const parsed = parseCanonicalPath(pathname);
  if (parsed.surface === "tenant-admin") return parsed.logicalPath;
  return pathname.replace(/^\/admin\/s\/[^/]+/, "/admin");
}

/** @summary Localiza el grupo que contiene una ruta para abrirlo al navegar desde búsquedas o accesos directos. */
function groupIdForHref(href: string) {
  return navigationGroups.find((group) => group.links.some((link) => link.href === href))?.id ?? "inicio";
}

/** @summary Organiza la navegación administrativa y su contenido con un diseño adaptable. */
export function AdminShell({
  children,
  permissions,
  tenantName,
  tenantSlug,
  publicSiteUrl,
  isSuperAdmin = false,
  adminTheme = "menuclick-dark",
  adminAccent = "#ec4899",
  palette = defaultPalette,
  branches = [],
  activeBranchId,
  allBranches = false,
}: {
  children: React.ReactNode;
  permissions: string[];
  tenantName: string;
  tenantSlug: string;
  publicSiteUrl: string;
  isSuperAdmin?: boolean;
  adminTheme?: string;
  adminAccent?: string;
  palette?: PaletteColors;
  branches?: Array<{ id: number; name: string; slug: string; isPrimary: boolean }>;
  activeBranchId?: number;
  allBranches?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearPath = normalizedAdminPath(pathname);
  const isCurrent = (href: string) => isActivePath(clearPath, href);
  const branchNavigationAvailable = isBranchAdminLogicalPath(clearPath);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandResults, setCommandResults] = useState<SearchResults | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandActive, setCommandActive] = useState(0);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === pathname;
  const activeBranch = branches.find((branch) => branch.id === activeBranchId);
  const branchSlug = activeBranch?.slug;
  const adminHref = useCallback(
    (href: string) => adminHrefForContext(tenantSlug, href, branchSlug),
    [branchSlug, tenantSlug],
  );
  const publicSite = activeBranch?.slug ? `${publicSiteUrl}/s/${activeBranch.slug}` : publicSiteUrl;
  const [openGroup, setOpenGroup] = useState<string>(
    () =>
      navigationGroups.find((group) => group.links.some((link) => isCurrent(link.href)))?.id ??
      "inicio",
  );

  useEffect(() => {
    if (!mobileMenuOpen && !commandOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [commandOpen, mobileMenuOpen]);
  const accessibleLinks = useMemo(
    () => links.filter((link) => permissions.includes(link.permission)),
    [permissions],
  );
  const accessibleGroups = useMemo(
    () =>
      navigationGroups
        .map((group) => ({
          ...group,
          links: group.links.filter((link) => permissions.includes(link.permission)),
        }))
        .filter((group) => group.links.length > 0),
    [permissions],
  );
  const commandLinks = accessibleLinks.filter((link) =>
    link.label.toLocaleLowerCase("es").includes(commandQuery.trim().toLocaleLowerCase("es")),
  );

  /** @summary Busca de forma consolidada (pedidos, clientes, reservas, productos) con debounce. */
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const query = commandQuery.trim();
      if (query.length < 2) {
        setCommandResults(null);
        setCommandLoading(false);
        setCommandActive(0);
        return;
      }
      setCommandLoading(true);
      try {
        const response = await scopedFetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("search-failed");
        const data = (await response.json()) as SearchResults;
        setCommandResults(data);
        setCommandActive(0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCommandResults(null);
      } finally {
        if (!controller.signal.aborted) setCommandLoading(false);
      }
    }, 240);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [commandQuery]);

  const commandGroups = useMemo(() => {
    const groups: Array<{ id: string; label: string; items: PaletteEntry[] }> = [];
    const sectionItems: PaletteEntry[] = commandLinks.map((link) => ({
      key: `section-${link.href}`,
      group: "sections",
      label: link.label,
      icon: link.icon,
      href: adminHref(link.href),
      logicalHref: link.href,
    }));
    if (sectionItems.length) groups.push({ id: "sections", label: "Secciones", items: sectionItems });

    const results = commandResults;
    if (results) {
      const orderItems: PaletteEntry[] = results.orders.map((order) => ({
        key: `order-${order.id}`,
        group: "orders",
        label: `${order.reference} · ${order.customerName}`,
        sublabel: `${order.orderType.replaceAll("_", " ")} · ${order.status.replaceAll("_", " ")}`,
        icon: "PE",
        href: adminHref(`/admin/pedidos?id=${order.id}`),
      }));
      if (orderItems.length) groups.push({ id: "orders", label: "Pedidos", items: orderItems });

      const customerItems: PaletteEntry[] = results.customers.map((customer) => ({
        key: `customer-${customer.id}`,
        group: "customers",
        label: customer.name,
        sublabel: customer.email || customer.phone || `${customer.points} puntos`,
        icon: "CF",
        href: adminHref(`/admin/clientes-frecuentes?id=${customer.id}`),
      }));
      if (customerItems.length) groups.push({ id: "customers", label: "Clientes", items: customerItems });

      const reservationItems: PaletteEntry[] = results.reservations.map((reservation) => ({
        key: `reservation-${reservation.id}`,
        group: "reservations",
        label: `${reservation.reference} · ${reservation.customerName}`,
        sublabel: `${reservation.reservationDate}${reservation.reservationTime ? ` ${String(reservation.reservationTime).slice(0, 5)}` : ""} · ${reservation.status.replaceAll("_", " ")}`,
        icon: "RS",
        href: adminHref(`/admin/reservas?id=${reservation.id}`),
      }));
      if (reservationItems.length) groups.push({ id: "reservations", label: "Reservas", items: reservationItems });

      const productItems: PaletteEntry[] = results.products.map((product) => ({
        key: `product-${product.id}`,
        group: "products",
        label: product.name,
        sublabel: product.price
          ? `$${Number(product.price).toLocaleString("es-AR")} · ${product.status}`
          : product.status,
        icon: "PR",
        href: adminHref(`/admin/productos?id=${product.id}`),
      }));
      if (productItems.length) groups.push({ id: "products", label: "Productos", items: productItems });
    }
    return groups;
  }, [adminHref, commandLinks, commandResults]);

  const commandItems = useMemo(() => commandGroups.flatMap((group) => group.items), [commandGroups]);

  function closeCommand() {
    setCommandOpen(false);
    setCommandQuery("");
    setCommandResults(null);
    setCommandActive(0);
  }

  useEffect(() => {
    /** @summary Abre comandos rápidos con Ctrl o Cmd más K y los cierra con Escape. */
    function keyboardShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("es") === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileMenuPath(null);
      }
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
    try {
      const response = await scopedFetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("logout-failed");
      window.location.replace(tenantPublicPath(tenantSlug, "/login"));
    } catch {
      await Swal.fire({
        title: "No se pudo cerrar la sesión",
        text: "Revisá tu conexión e intentá nuevamente.",
        icon: "error",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#ec4899",
        background: "#18181b",
        color: "#fafafa",
      });
    }
  }

  const navigationContent = (
    <>
      <nav
        className="space-y-2 overflow-y-auto overscroll-contain p-2 lg:max-h-[calc(100dvh-24rem)] lg:p-3"
        aria-label="Secciones administrativas"
      >
        {accessibleGroups.map((group) => {
          const expanded = openGroup === group.id;
          const containsActive = group.links.some((link) => isCurrent(link.href));
          return (
            <section
              className={`overflow-hidden rounded-2xl border transition ${
                containsActive
                  ? "border-pink-500/25 bg-pink-500/[.04]"
                  : "border-white/[.07] bg-white/[.02]"
              }`}
              key={group.id}
            >
              <button
                className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-white/5"
                type="button"
                aria-controls={`admin-group-${group.id}`}
                aria-expanded={expanded}
                onClick={() => setOpenGroup((current) => (current === group.id ? "" : group.id))}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-black tracking-wider ${
                    containsActive ? "bg-pink-500 text-white" : "bg-white/5 text-pink-300"
                  }`}
                >
                  {group.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm">{group.label}</strong>
                  <small className="hidden truncate text-[10px] text-zinc-600 xl:block">
                    {group.description}
                  </small>
                </span>
                <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-zinc-500">
                  {group.links.length}
                </span>
                <span
                  className={`text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                >
                  ⌄
                </span>
              </button>

              {expanded && (
                <div
                  className="space-y-1 border-t border-white/[.07] p-2"
                  id={`admin-group-${group.id}`}
                >
                  {group.links.map(({ href, label, icon }) => {
                    const active = isCurrent(href);
                    return (
                      <Link
                        className={`group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-bold transition ${
                          active
                            ? "bg-pink-500 text-white shadow-lg shadow-pink-950/30"
                            : "text-zinc-400 hover:bg-white/5 hover:text-white"
                        }`}
                        href={adminHref(href) as Route}
                        key={href}
                        onClick={() => setMobileMenuPath(null)}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black tracking-wider ${
                            active
                              ? "bg-white/20"
                              : "bg-white/5 text-pink-300 group-hover:bg-pink-500/15"
                          }`}
                        >
                          {icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}

        {isSuperAdmin && (
          <Link
            className="group flex items-center gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/10"
            href={platformAdminPath() as Route}
            onClick={() => setMobileMenuPath(null)}
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-[10px] font-black">
              SA
            </span>
            Plataforma
          </Link>
        )}
      </nav>

      <div className="border-t border-white/10 p-3 print:hidden">
        <button
          className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-sm font-bold text-zinc-300 hover:bg-white/10"
          onClick={() => {
            setCommandOpen(true);
            setMobileMenuPath(null);
          }}
          type="button"
        >
          <span>Buscar o ir a…</span>
          <kbd className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-500">
            Ctrl K
          </kbd>
        </button>
      </div>

      {permissions.includes("notification.manage") && <NotificationCenter />}

      <div className="border-t border-white/10 p-3">
        <button
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-red-300 hover:bg-red-500/10"
          onClick={logout}
          type="button"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/10">→</span>
          Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <div className={`admin-theme admin-theme-${adminTheme} min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_left,var(--admin-glow),transparent_30%),var(--admin-background)]`} style={{ ...paletteCssVariables(palette), colorScheme: palette.baseMode, "--admin-primary-strong": palette.primary, "--admin-primary": palette.primary, "--admin-accent-legacy": adminAccent } as React.CSSProperties}>
      <div className="admin-shell shell grid gap-6 py-6 lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-9 lg:py-9">
        <aside className="sticky top-0 z-60 lg:hidden">
          <button
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/95 p-2.5 text-left shadow-2xl shadow-black/40 backdrop-blur-xl"
            type="button"
            aria-controls="admin-navigation-panel"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuPath((current) => current === pathname ? null : pathname)}
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-pink-500/15 text-lg text-pink-300">
              ☰
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">{tenantName} · Principal</strong>
            </span>
            <span
              className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-lg transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            >
              ⌄
            </span>
          </button>
        </aside>

        <aside className="sticky top-20 z-40 hidden h-fit overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/90 shadow-2xl shadow-black/40 backdrop-blur-xl lg:block">
          <div className="border-b border-white/10 p-6">
            <p className="text-xs font-black uppercase tracking-[.28em] text-[var(--admin-primary)]">{tenantName} Studio</p>
<h2 className="mt-2 text-2xl font-black">Administración</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Gestioná el contenido que ven tus clientes.
            </p>
            <div className="mt-5 space-y-3">
              {branchNavigationAvailable && (
                <BranchSwitcher
                  branches={branches}
                  activeBranchId={activeBranchId}
                  activeBranchName={activeBranch?.name}
                  consolidatedAvailable={allBranches}
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <a
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-black text-zinc-300 hover:bg-pink-500 hover:text-white"
                  href={publicSite}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver sitio
                </a>
                <a
                  className="rounded-xl border border-pink-500/20 bg-pink-500/10 px-3 py-2 text-center text-xs font-black text-pink-200 hover:bg-pink-500 hover:text-white"
                  href={`${publicSite}/carta`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver carta
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10">{navigationContent}</div>
        </aside>

        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuPath(null)}
              aria-hidden="true"
            />
            <div
              id="admin-navigation-panel"
              className="fixed inset-y-0 left-0 z-[200] flex h-dvh w-[min(20rem,88vw)] max-w-full flex-col border-r border-white/10 bg-zinc-950 shadow-2xl shadow-black/50 lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Menú de administración"
            >
              <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 pt-[env(safe-area-inset-top)]">
                <span className="min-w-0">
                  <small className="block text-[10px] font-black uppercase tracking-[.2em] text-zinc-500">
                    Administración
                  </small>
                  <strong className="block truncate text-sm">{tenantName} · Principal</strong>
                </span>
                <button
                  type="button"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-white transition hover:bg-white/10"
                  onClick={() => setMobileMenuPath(null)}
                  aria-label="Cerrar navegación"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-3">
                <a
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-black text-zinc-300 hover:bg-pink-500 hover:text-white"
                  href={publicSite}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver sitio
                </a>
                <a
                  className="rounded-xl border border-pink-500/20 bg-pink-500/10 px-3 py-2 text-center text-xs font-black text-pink-200 hover:bg-pink-500 hover:text-white"
                  href={`${publicSite}/carta`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver carta
                </a>
              </div>
              <div className="flex-1 overflow-y-auto overscroll-contain">{navigationContent}</div>
            </div>
          </>
        )}

         <main className="admin-main min-w-0">{children}</main>
      </div>
      {commandOpen && (
        <div
          className="fixed inset-0 z-[150] grid place-items-start bg-black/80 p-4 pt-[10vh] backdrop-blur"
          onClick={closeCommand}
        >
          <section
            className="mx-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Búsqueda global"
          >
            <label className="block border-b border-white/10 p-4">
              <span className="sr-only">Buscar en todo el panel</span>
              <input
                className="w-full bg-transparent text-xl font-bold outline-none"
                value={commandQuery}
                onChange={(event) => {
                  setCommandQuery(event.target.value);
                  setCommandActive(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCommandActive((current) =>
                      commandItems.length ? (current + 1) % commandItems.length : 0,
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCommandActive((current) =>
                      commandItems.length ? (current - 1 + commandItems.length) % commandItems.length : 0,
                    );
                  } else if (event.key === "Enter") {
                    const target = commandItems[commandActive];
                    if (target) {
                      event.preventDefault();
                      router.push(target.href);
                      closeCommand();
                    }
                  } else if (event.key === "Escape") {
                    closeCommand();
                  }
                }}
                placeholder="Buscá pedidos, clientes, reservas, productos o secciones…"
                autoFocus
              />
              {commandQuery.trim().length >= 2 && (
                <p className="mt-2 text-xs text-zinc-500">
                  {commandLoading ? "Buscando…" : "Resultados de todo el negocio (solo tu sucursal)."}
                </p>
              )}
            </label>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {commandGroups.map((group) => (
                <section key={group.id}>
                  <h2 className="px-3 pb-1 pt-3 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    {group.label} <span className="text-zinc-600">({group.items.length})</span>
                  </h2>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const active = item.key === commandItems[commandActive]?.key;
                      return (
                        <Link
                          className={`flex items-center gap-3 rounded-2xl p-3 ${
                            active ? "bg-pink-500/10 ring-1 ring-pink-500/30" : "hover:bg-white/5"
                          }`}
                          href={item.href}
                          key={item.key}
                          onMouseEnter={() => setCommandActive(commandItems.findIndex((entry) => entry.key === item.key))}
                          onClick={() => {
                            closeCommand();
                            setOpenGroup(groupIdForHref(item.logicalHref ?? (item.href as unknown as string)));
                            setMobileMenuPath(null);
                          }}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pink-500/10 text-[10px] font-black text-pink-300">
                            {item.icon}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate">{item.label}</strong>
                            {item.sublabel && (
                              <small className="block truncate text-xs text-zinc-500">{item.sublabel}</small>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
              {!commandGroups.length && (
                <p className="p-8 text-center text-sm text-zinc-500">
                  {commandQuery.trim().length < 2
                    ? "Escribí al menos dos caracteres para buscar."
                    : "No encontramos resultados para esa búsqueda."}
                </p>
              )}
            </div>
            <footer className="flex items-center gap-4 border-t border-white/10 px-4 py-2.5 text-[10px] text-zinc-600">
              <span>
                <kbd className="rounded-md border border-white/10 px-1.5 py-0.5">↑</kbd>{" "}
                <kbd className="rounded-md border border-white/10 px-1.5 py-0.5">↓</kbd> navegar
              </span>
              <span>
                <kbd className="rounded-md border border-white/10 px-1.5 py-0.5">↵</kbd> abrir
              </span>
              <span>
                <kbd className="rounded-md border border-white/10 px-1.5 py-0.5">Esc</kbd> cerrar
              </span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
