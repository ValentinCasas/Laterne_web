"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import Swal from "sweetalert2";
import { BranchSwitcher } from "@/components/admin/branch-switcher";
import { NotificationCenter } from "@/components/admin/notification-center";
import { defaultPalette, paletteCssVariables, type PaletteColors } from "@/lib/theme-palettes";
import {
  adminHrefForContext,
  isBranchAdminLogicalPath,
  parseCanonicalPath,
  platformAdminPath,
  tenantPublicPath,
} from "@/lib/routes";
import { scopedFetch } from "@/lib/client-routing";
import {
  adminGroupIdForHref,
  adminGroupsForPermissions,
  adminNavLinks,
  findActiveAdminLink,
  type AdminNavItem,
} from "@/lib/admin-navigation";

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

/** @summary Iniciales del nombre del tenant para la marca del panel. */
function tenantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** @summary Cantidad de columnas del mega menú según sus secciones. */
function megaMenuColumns(count: number) {
  if (count >= 3) return "sm:grid-cols-2 lg:grid-cols-3";
  if (count === 2) return "sm:grid-cols-2";
  return "";
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M14 4h6v6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m20 4-9 9" strokeLinecap="round" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" strokeLinecap="round" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m16 17 5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** @summary Menú de perfil de la barra superior: cuenta, acceso público y cierre de sesión. */
function ProfileMenu({
  name,
  adminHref,
  publicSite,
  onLogout,
}: {
  name: string;
  adminHref: (href: string) => Route;
  publicSite: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    /** @summary Cierra el menú al interactuar fuera de él o con Escape. */
    function handlePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 text-sm font-bold text-zinc-200 hover:border-white/25"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-pink-500/15 text-[10px] font-black text-pink-300">
          {tenantInitials(name)}
        </span>
        <span className="hidden max-w-28 truncate xl:block">{name}</span>
        <ChevronDownIcon open={open} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 p-1.5 shadow-2xl"
          role="menu"
        >
          <Link
            role="menuitem"
            href={adminHref("/admin/cuenta")}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/10"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-[10px] font-black text-pink-300">
              MC
            </span>
            Mi cuenta
          </Link>
          <a
            role="menuitem"
            href={publicSite}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/10"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-[10px] font-black text-pink-300">
              VS
            </span>
            Ver sitio
            <span className="ml-auto text-zinc-600">
              <ExternalIcon />
            </span>
          </a>
          <a
            role="menuitem"
            href={`${publicSite}/carta`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/10"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/5 text-[10px] font-black text-pink-300">
              VC
            </span>
            Ver carta
            <span className="ml-auto text-zinc-600">
              <ExternalIcon />
            </span>
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-red-500/10 text-[10px] font-black">
              <LogoutIcon />
            </span>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

/** @summary Convierte la URL visible canónica al path lógico que usan las definiciones del menú. */
function normalizedAdminPath(pathname: string) {
  const parsed = parseCanonicalPath(pathname);
  if (parsed.surface === "tenant-admin") return parsed.logicalPath;
  return pathname.replace(/^\/admin\/s\/[^/]+/, "/admin");
}

/** @summary Organiza la navegación administrativa con barra superior, mega menú y drawer móvil. */
export function AdminShell({
  children,
  permissions,
  tenantName,
  tenantSlug,
  tenantGuid,
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
  tenantGuid?: string;
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
  const branchNavigationAvailable = isBranchAdminLogicalPath(clearPath);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandResults, setCommandResults] = useState<SearchResults | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandActive, setCommandActive] = useState(0);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === pathname;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const openGroupRef = useRef<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [panelFocusIndex, setPanelFocusIndex] = useState(-1);
  const headerRef = useRef<HTMLElement | null>(null);
  const megaPanelRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const mobileMenuOpenRef = useRef(false);

  const activeBranch = branches.find((branch) => branch.id === activeBranchId);
  const branchSlug = activeBranch?.slug;
  const adminHref = useCallback(
    (href: string) => adminHrefForContext(tenantSlug, href, branchSlug, tenantGuid),
    [branchSlug, tenantGuid, tenantSlug],
  );
  const publicSite = activeBranch?.slug ? `${publicSiteUrl}/s/${activeBranch.slug}` : publicSiteUrl;

  const accessibleLinks = useMemo(
    () => adminNavLinks().filter((link) => permissions.includes(link.permission)),
    [permissions],
  );
  const accessibleGroups = useMemo(() => adminGroupsForPermissions(permissions), [permissions]);
  const activeLink = useMemo(
    () => findActiveAdminLink(accessibleGroups, clearPath),
    [accessibleGroups, clearPath],
  );
  const activeGroupId = useMemo(
    () => (activeLink ? adminGroupIdForHref(activeLink.href) : null),
    [activeLink],
  );

  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  /** @summary Cierra el mega menú y devuelve el foco al disparador. */
  const closeMegaMenu = useCallback(() => {
    const current = openGroupRef.current;
    setOpenGroup(null);
    setPanelFocusIndex(-1);
    if (current && triggerRefs.current[current]) triggerRefs.current[current]?.focus();
  }, []);

  /** @summary Programa el cierre del mega menú al salir del área del panel. */
  const scheduleCloseGroup = useCallback(() => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpenGroup(null), 140);
  }, []);

  /** @summary Cancela el cierre diferido del mega menú (el puntero volvió al área). */
  const cancelCloseGroup = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  function setOpenGroupBoth(value: string | null) {
    if (openGroupRef.current !== value) setPanelFocusIndex(-1);
    openGroupRef.current = value;
    setOpenGroup(value);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !commandOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [commandOpen, mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    mobileCloseButtonRef.current?.focus();
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!openGroup) return;
    /** @summary Cierra el mega menú al interactuar fuera de la barra o del panel. */
    function handlePointer(event: PointerEvent) {
      const target = event.target as Node;
      if (headerRef.current?.contains(target)) return;
      if (megaPanelRef.current?.contains(target)) return;
      setOpenGroup(null);
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
  }, [openGroup]);

  /** @summary Navegación con teclado dentro del panel del mega menú. */
  function handlePanelKeyDown(event: ReactKeyboardEvent<HTMLElement>, items: AdminNavItem[]) {
    if (items.length === 0) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMegaMenu();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      let next = panelFocusIndex;
      if (event.key === "ArrowDown") next += 1;
      else if (event.key === "ArrowUp") next -= 1;
      else if (event.key === "Home") next = 0;
      else next = items.length - 1;
      next = Math.max(0, Math.min(items.length - 1, next));
      setPanelFocusIndex(next);
      panelItemRefs.current[next]?.focus();
    }
  }

  /** @summary Cierra el panel cuando el foco sale de la barra y del panel (Tab). */
  function handlePanelBlur(event: ReactFocusEvent<HTMLElement>) {
    const next = event.relatedTarget as Node | null;
    if (next && (headerRef.current?.contains(next) || megaPanelRef.current?.contains(next))) return;
    setOpenGroup(null);
  }

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
      if (reservationItems.length)
        groups.push({ id: "reservations", label: "Reservas", items: reservationItems });

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

  /**
   * @summary Cierra la paleta de comandos y restablece su búsqueda.
   */
  function closeCommand() {
    setCommandOpen(false);
    setCommandQuery("");
    setCommandResults(null);
    setCommandActive(0);
  }

  useEffect(() => {
    /** @summary Abre comandos rápidos con Ctrl o Cmd más K y cierra paneles con Escape. */
    function keyboardShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase("es") === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        if (mobileMenuOpenRef.current) {
          setMobileMenuPath(null);
          mobileTriggerRef.current?.focus();
        } else {
          closeMegaMenu();
        }
      }
    }
    window.addEventListener("keydown", keyboardShortcut);
    return () => window.removeEventListener("keydown", keyboardShortcut);
  }, [closeMegaMenu]);

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

  const activeGroup = openGroup
    ? (accessibleGroups.find((candidate) => candidate.id === openGroup) ?? null)
    : null;

  return (
    <div
      className={`admin-shell admin-theme admin-theme-${adminTheme} min-h-dvh bg-[radial-gradient(circle_at_top_left,var(--admin-glow),transparent_30%),var(--admin-background)]`}
      style={
        {
          ...paletteCssVariables(palette),
          colorScheme: palette.baseMode,
          "--admin-primary-strong": palette.primary,
          "--admin-primary": palette.primary,
          "--admin-accent-legacy": adminAccent,
        } as React.CSSProperties
      }
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/90 backdrop-blur-xl print:hidden"
      >
        <div className="shell flex h-16 items-center gap-2 sm:gap-3">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-lg text-white hover:bg-white/10 lg:hidden"
            aria-controls="admin-navigation-panel"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => {
              if (mobileMenuOpen) {
                setMobileMenuPath(null);
              } else {
                setMobileMenuPath(pathname);
                setMobileExpanded(activeGroupId);
              }
            }}
          >
            <span aria-hidden="true">{mobileMenuOpen ? "×" : "☰"}</span>
          </button>

          <Link
            href={adminHref("/admin")}
            className="flex shrink-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 hover:bg-white/5"
            onClick={() => {
              setOpenGroup(null);
              setMobileMenuPath(null);
            }}
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--admin-primary-strong)] text-sm font-black text-white">
              {tenantInitials(tenantName)}
            </span>
            <span className="hidden min-w-0 leading-tight sm:block">
              <strong className="block max-w-44 truncate text-sm">{tenantName}</strong>
              <small className="block text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">
                Administración
              </small>
            </span>
          </Link>

          <nav
            className="hidden items-center gap-0.5 lg:flex lg:min-w-0"
            aria-label="Secciones administrativas"
            onMouseLeave={scheduleCloseGroup}
          >
            {accessibleGroups.map((group) => {
              const groupActive = activeGroupId === group.id;
              const expanded = openGroup === group.id;
              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => {
                    cancelCloseGroup();
                    setOpenGroupBoth(group.id);
                  }}
                >
                  <button
                    ref={(element) => {
                      triggerRefs.current[group.id] = element;
                    }}
                    type="button"
                    className={`flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition ${
                      expanded || groupActive
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    }`}
                    aria-haspopup="true"
                    aria-expanded={expanded}
                    aria-current={groupActive ? "page" : undefined}
                    onClick={() => {
                      if (expanded) {
                        closeMegaMenu();
                      } else {
                        cancelCloseGroup();
                        setOpenGroupBoth(group.id);
                      }
                    }}
                  >
                    <span className="truncate">{group.label}</span>
                    <ChevronDownIcon open={expanded} />
                  </button>
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            {branchNavigationAvailable && (
              <BranchSwitcher
                branches={branches}
                activeBranchId={activeBranchId}
                activeBranchName={activeBranch?.name}
                consolidatedAvailable={allBranches}
                compact
              />
            )}

            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-zinc-300 hover:border-white/25"
              onClick={() => {
                setCommandOpen(true);
                setMobileMenuPath(null);
              }}
            >
              <SearchIcon />
              <span className="hidden xl:inline">Buscar</span>
              <kbd className="hidden rounded-lg border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500 2xl:inline">
                Ctrl K
              </kbd>
            </button>

            {permissions.includes("notification.manage") && <NotificationCenter compact />}

            <a
              href={publicSite}
              target="_blank"
              rel="noreferrer"
              className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-bold text-zinc-300 hover:border-white/25 lg:flex"
            >
              <ExternalIcon />
              <span className="hidden 2xl:inline">Ver sitio</span>
            </a>

            {isSuperAdmin && (
              <Link
                href={platformAdminPath()}
                className="hidden h-10 items-center gap-2 rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 text-sm font-bold text-amber-300 hover:bg-amber-500/10 sm:flex"
              >
                <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-500/15 text-[8px] font-black">
                  SA
                </span>
                <span className="hidden xl:inline">Plataforma</span>
              </Link>
            )}

            <ProfileMenu name={tenantName} adminHref={adminHref} publicSite={publicSite} onLogout={logout} />
          </div>
        </div>
      </header>

      {activeGroup && (
        <div
          ref={megaPanelRef}
          className="fixed inset-x-0 top-16 z-40 print:hidden"
          role="region"
          aria-label={`Secciones de ${activeGroup.label}`}
          onMouseEnter={cancelCloseGroup}
          onMouseLeave={scheduleCloseGroup}
          onKeyDown={(event) =>
            handlePanelKeyDown(
              event,
              activeGroup.sections.flatMap((section) => [...section.items]),
            )
          }
          onBlur={handlePanelBlur}
        >
          <div className="shell overflow-hidden rounded-b-3xl border border-t-0 border-white/10 bg-[var(--admin-surface)] shadow-2xl shadow-black/40">
            <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-pink-500/15 text-xs font-black text-pink-300">
                {activeGroup.icon}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--admin-primary)]">
                  {activeGroup.label}
                </p>
                <p className="truncate text-sm text-zinc-500">{activeGroup.description}</p>
              </div>
            </div>
            <div className={`grid gap-8 px-6 py-6 ${megaMenuColumns(activeGroup.sections.length)}`}>
              {(() => {
                let flatIndex = 0;
                return activeGroup.sections.map((section) => (
                  <section key={section.id} className="min-w-0">
                    <h2 className="mb-2 text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">
                      {section.label}
                    </h2>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const index = flatIndex++;
                        const active = activeLink?.href === item.href;
                        return (
                          <Link
                            key={item.href}
                            ref={(element) => {
                              panelItemRefs.current[index] = element;
                            }}
                            href={adminHref(item.href)}
                            tabIndex={panelFocusIndex === -1 || panelFocusIndex === index ? 0 : -1}
                            onClick={() => {
                              setOpenGroupBoth(null);
                              setMobileMenuPath(null);
                            }}
                            className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold transition ${
                              active
                                ? "bg-pink-500 text-white shadow-lg shadow-pink-950/30"
                                : "text-zinc-400 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span
                              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black tracking-wider ${
                                active ? "bg-white/20" : "bg-white/5 text-pink-300 group-hover:bg-pink-500/15"
                              }`}
                            >
                              {item.icon}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      <main className="admin-main shell py-6 lg:py-8">{children}</main>

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
                <strong className="block truncate text-sm">{tenantName}</strong>
              </span>
              <button
                ref={mobileCloseButtonRef}
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-lg text-white transition hover:bg-white/10"
                onClick={() => setMobileMenuPath(null)}
                aria-label="Cerrar navegación"
              >
                ×
              </button>
            </div>

            <div className="grid gap-2 border-b border-white/10 px-3 py-3">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-zinc-300 hover:border-white/25"
                onClick={() => {
                  setCommandOpen(true);
                  setMobileMenuPath(null);
                }}
              >
                <SearchIcon />
                <span>Buscar o ir a…</span>
              </button>
              {branchNavigationAvailable && (
                <BranchSwitcher
                  branches={branches}
                  activeBranchId={activeBranchId}
                  activeBranchName={activeBranch?.name}
                  consolidatedAvailable={allBranches}
                />
              )}
            </div>

            <nav
              className="flex-1 space-y-2 overflow-y-auto overscroll-contain p-3"
              aria-label="Secciones administrativas"
            >
              {accessibleGroups.map((group) => {
                const expanded = mobileExpanded === group.id;
                const containsActive = activeGroupId === group.id;
                return (
                  <section
                    key={group.id}
                    className={`overflow-hidden rounded-2xl border transition ${
                      containsActive
                        ? "border-pink-500/25 bg-pink-500/[.04]"
                        : "border-white/[.07] bg-white/[.02]"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-white/5"
                      aria-controls={`mobile-admin-group-${group.id}`}
                      aria-expanded={expanded}
                      onClick={() => setMobileExpanded((current) => (current === group.id ? null : group.id))}
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
                        <small className="hidden truncate text-[10px] text-zinc-600">
                          {group.description}
                        </small>
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
                        id={`mobile-admin-group-${group.id}`}
                        className="space-y-3 border-t border-white/[.07] p-3"
                      >
                        {group.sections.map((section) => (
                          <div key={section.id}>
                            <h3 className="mb-1 px-2 text-[10px] font-black uppercase tracking-[.18em] text-zinc-500">
                              {section.label}
                            </h3>
                            <div className="space-y-0.5">
                              {section.items.map((item) => {
                                const active = activeLink?.href === item.href;
                                return (
                                  <Link
                                    key={item.href}
                                    href={adminHref(item.href)}
                                    onClick={() => setMobileMenuPath(null)}
                                    className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-bold transition ${
                                      active
                                        ? "bg-pink-500 text-white shadow-lg shadow-pink-950/30"
                                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                                    }`}
                                  >
                                    <span
                                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black tracking-wider ${
                                        active ? "bg-white/20" : "bg-white/5 text-pink-300"
                                      }`}
                                    >
                                      {item.icon}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}

              {isSuperAdmin && (
                <Link
                  href={platformAdminPath()}
                  onClick={() => setMobileMenuPath(null)}
                  className="flex items-center gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/5 px-3 py-3 text-sm font-bold text-amber-300 hover:bg-amber-500/10"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-500/10 text-[10px] font-black">
                    SA
                  </span>
                  Plataforma
                </Link>
              )}
            </nav>

            <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3">
              <a
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center text-xs font-black text-zinc-300 hover:bg-pink-500 hover:text-white"
                href={publicSite}
                target="_blank"
                rel="noreferrer"
              >
                Ver sitio
              </a>
              <a
                className="rounded-xl border border-pink-500/20 bg-pink-500/10 px-3 py-2.5 text-center text-xs font-black text-pink-200 hover:bg-pink-500 hover:text-white"
                href={`${publicSite}/carta`}
                target="_blank"
                rel="noreferrer"
              >
                Ver carta
              </a>
              <button
                type="button"
                onClick={logout}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-red-500/15 bg-red-500/5 px-3 py-2.5 text-center text-xs font-black text-red-300 hover:bg-red-500/10"
              >
                <LogoutIcon />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

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
                          onMouseEnter={() =>
                            setCommandActive(commandItems.findIndex((entry) => entry.key === item.key))
                          }
                          onClick={() => {
                            closeCommand();
                            setOpenGroupBoth(null);
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
