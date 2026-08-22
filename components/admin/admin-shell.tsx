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
import { ProfileMenu } from "@/components/admin/profile-menu";
import { defaultPalette, paletteCssVariables, type PaletteColors } from "@/lib/theme-palettes";
import { SearchBox } from "@/components/admin/ui";
import { Icon } from "@/components/admin/ui/icons";
import { UserAvatar } from "@/components/admin/ui/avatar";
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
import { useNavigationMode } from "@/hooks/use-navigation-mode";
import { AdminShellSidebar } from "@/components/admin/admin-shell-sidebar";

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
  restricted?: boolean;
};

/** @summary Iniciales del nombre del tenant para la marca del panel. */
function tenantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "MC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="17" r=".5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
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
      strokeWidth="1.8"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m16 17 5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12H9" strokeLinecap="round" />
    </svg>
  );
}

function ChevronDownIcon({ open = false, className = "" }: { open?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-3 w-3 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""} ${className}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
  roleKey,
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
  userName,
  userEmail,
  userImageUrl,
}: {
  children: React.ReactNode;
  permissions: string[];
  roleKey?: string;
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
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const clearPath = normalizedAdminPath(pathname);
  const [locationHash, setLocationHash] = useState("");
  const branchNavigationAvailable = isBranchAdminLogicalPath(clearPath);
  const { mode: navigationMode, setMode: setNavigationMode } = useNavigationMode();
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandResults, setCommandResults] = useState<SearchResults | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandActive, setCommandActive] = useState(0);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === pathname;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const openGroupRef = useRef<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const [panelFocusIndex, setPanelFocusIndex] = useState(-1);
  const headerRef = useRef<HTMLElement | null>(null);
  const megaPanelRef = useRef<HTMLDivElement | null>(null);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelItemRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuOpenRef = useRef(false);
  const [overflowIds, setOverflowIds] = useState<string[]>([]);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const [sidebarCompact, setSidebarCompact] = useState(false);

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
  const accessibleGroups = useMemo(
    () => adminGroupsForPermissions(permissions, roleKey, isSuperAdmin),
    [permissions, roleKey, isSuperAdmin],
  );
  /** @summary Conserva el ancla visible para activar una subsección específica de una página compartida. */
  useEffect(() => {
    function syncLocationHash() {
      setLocationHash(window.location.hash);
    }
    syncLocationHash();
    window.addEventListener("hashchange", syncLocationHash);
    return () => window.removeEventListener("hashchange", syncLocationHash);
  }, [pathname]);
  const activeLink = useMemo(
    () => findActiveAdminLink(accessibleGroups, `${clearPath}${locationHash}`),
    [accessibleGroups, clearPath, locationHash],
  );
  const activeGroupId = useMemo(
    () => (activeLink ? adminGroupIdForHref(activeLink.href) : null),
    [activeLink],
  );

  useEffect(() => {
    mobileMenuOpenRef.current = mobileMenuOpen;
  }, [mobileMenuOpen]);

  /** @summary Mide el ancho disponible del nav y calcula qué grupos caben. Los que no caben van a "Más". */
  useEffect(() => {
    function measureOverflow() {
      const container = navContainerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth;
      // Medir cada grupo individualmente
      const widths = accessibleGroups.map((group) => {
        const el = triggerRefs.current[group.id];
        return { id: group.id, width: el ? el.getBoundingClientRect().width : 120 };
      });
      // El botón "Más" ocupa ~60px cuando hay overflow groups
      const maisButtonWidth = 64;
      const gap = 4; // gap-1 = 4px entre items
      let usedWidth = 0;
      const visible: string[] = [];
      const overflow: string[] = [];
      for (const item of widths) {
        const needed = visible.length === 0 ? item.width : usedWidth + gap + item.width;
        // Reservar espacio para "Más" si ya hay algo que ocultar
      const reserveForMais = overflow.length > 0 ? maisButtonWidth + gap : 0;
      if (needed + reserveForMais <= containerWidth) {
        visible.push(item.id);
        usedWidth = needed;
      } else {
        overflow.push(item.id);
      }
    }
    if (visible.length > 5) {
      const excess = visible.splice(5);
      overflow.unshift(...excess);
    }
    setOverflowIds(overflow);
    }
    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    if (navContainerRef.current) observer.observe(navContainerRef.current);
    window.addEventListener("resize", measureOverflow);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureOverflow);
    };
  }, [accessibleGroups]);

  /** @summary Cierra el dropdown de overflow al hacer click afuera. */
  useEffect(() => {
    if (!overflowOpen) return;
    function handlePointer(event: PointerEvent) {
      if (overflowRef.current?.contains(event.target as Node)) return;
      setOverflowOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOverflowOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [overflowOpen]);

  const visibleGroups = useMemo(
    () => accessibleGroups.filter((g) => !overflowIds.includes(g.id)),
    [accessibleGroups, overflowIds],
  );
  const overflowGroups = useMemo(
    () => accessibleGroups.filter((g) => overflowIds.includes(g.id)),
    [accessibleGroups, overflowIds],
  );

  /** @summary Cierra el mega menú y devuelve el foco al disparador. */
  const closeMegaMenu = useCallback(() => {
    const current = openGroupRef.current;
    setOpenGroup(null);
    setActiveSectionId(null);
    setPanelFocusIndex(-1);
    setOverflowOpen(false);
    if (current && triggerRefs.current[current]) triggerRefs.current[current]?.focus();
  }, []);

  function setOpenGroupBoth(value: string | null) {
    setOverflowOpen(false);
    if (openGroupRef.current !== value) {
      setPanelFocusIndex(-1);
      // Seleccionar la primera sección con items al abrir un grupo nuevo
      if (value) {
        const group = accessibleGroups.find((g) => g.id === value);
        setActiveSectionId(group?.sections[0]?.id ?? null);
      } else {
        setActiveSectionId(null);
      }
    }
    openGroupRef.current = value;
    setOpenGroup(value);
  }

  /** @summary Explica por qué el panel personal no está disponible sin alterar permisos ni suplantar repartidores. */
  async function showDriverPanelAccessNotice() {
    const canViewDrivers = permissions.includes("driver.view");
    setOpenGroupBoth(null);
    setMobileMenuPath(null);
    setCommandOpen(false);
    setCommandQuery("");
    setCommandResults(null);
    setCommandActive(0);

    const result = await Swal.fire({
      title: "Panel del repartidor",
      text: "Esta vista personal está disponible para usuarios vinculados a un perfil de repartidor.",
      icon: "info",
      showConfirmButton: true,
      showCancelButton: canViewDrivers,
      confirmButtonText: canViewDrivers ? "Ver repartidores" : "Entendido",
      cancelButtonText: "Cerrar",
      confirmButtonColor: "#ec4899",
      background: "#18181b",
      color: "#fafafa",
    });

    if (result.isConfirmed && canViewDrivers) {
      router.push(adminHref("/admin/repartidores"));
    }
  }

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
      restricted: Boolean(link.accessPermission && !permissions.includes(link.accessPermission)),
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
  }, [adminHref, commandLinks, commandResults, permissions]);

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
      className={`admin-shell admin-theme admin-theme-${adminTheme} min-h-dvh overflow-x-hidden bg-[radial-gradient(circle_at_top_left,var(--admin-glow),transparent_30%),var(--admin-background)]`}
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
      {navigationMode === "SIDEBAR" ? (
        <AdminShellSidebar
          groups={accessibleGroups}
          activeGroupId={activeGroupId}
          activeLinkHref={activeLink?.href ?? null}
          adminHref={adminHref}
          onNavigate={() => {
            setOpenGroupBoth(null);
          }}
          onRestrictedNavigate={() => {
            void showDriverPanelAccessNotice();
          }}
          onLogout={logout}
          userName={userName}
          userEmail={userEmail}
          userImageUrl={userImageUrl}
          tenantName={tenantName}
          helpHref={permissions.includes("support.manage") ? adminHref("/admin/soporte") : undefined}
          publicSiteUrl={publicSite}
          compact={sidebarCompact}
          onToggleCompact={() => setSidebarCompact((c) => !c)}
          onOpenCommand={() => {
            setCommandOpen(true);
          }}
          permissions={permissions}
          branches={branches}
          activeBranchId={activeBranchId}
          allBranches={allBranches}
          branchNavigationAvailable={branchNavigationAvailable}
          onSwitchNavigationMode={() => setNavigationMode((current) => (current === "TOP" ? "SIDEBAR" : "TOP"))}
          currentMode={navigationMode}
        >
          {children}
        </AdminShellSidebar>
      ) : (
        <>
          <header
        ref={headerRef}
        data-admin-navbar="true"
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[.06] bg-zinc-950/85 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.3),0_1px_0_rgba(255,255,255,0.03)_inset] print:hidden"
      >
        <div className="admin-shell-inner flex h-14 items-center gap-1.5 px-3 sm:gap-2 sm:px-4 lg:px-6">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition-all duration-200 hover:bg-white/[.06] hover:text-white lg:hidden"
            aria-controls="admin-navigation-panel"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            title={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            onClick={() => {
              if (mobileMenuOpen) {
                setMobileMenuPath(null);
              } else {
                setMobileMenuPath(pathname);
                setMobileExpanded(activeGroupId);
              }
            }}
          >
            <span aria-hidden="true">{mobileMenuOpen ? <Icon name="x" className="h-5 w-5" /> : <Icon name="menu" className="h-5 w-5" />}</span>
          </button>

          <Link
            href={adminHref("/admin")}
            className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-200 hover:bg-white/[.04]"
            onClick={() => {
              setOpenGroup(null);
              setMobileMenuPath(null);
            }}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--admin-primary-strong)] text-sm font-black text-white">
              {tenantInitials(tenantName)}
            </span>
            <span className="hidden min-w-0 leading-tight sm:block">
              <strong className="block max-w-28 truncate text-sm font-semibold text-white xl:max-w-32">
                {tenantName}
              </strong>
              <small className="block text-[10px] font-bold uppercase tracking-[.16em] text-zinc-500">
                Administración
              </small>
            </span>
          </Link>

          <nav
            ref={navContainerRef}
            className="hidden min-w-0 flex-1 items-center justify-end gap-1 px-2 lg:flex xl:gap-1.5"
            aria-label="Secciones administrativas"
          >
            {visibleGroups.map((group) => {
              const groupActive = activeGroupId === group.id;
              const expanded = openGroup === group.id;
              return (
                <div key={group.id} className="shrink-0">
                  <button
                    ref={(element) => {
                      triggerRefs.current[group.id] = element;
                    }}
                    type="button"
                    className={`relative flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-all duration-200 xl:px-3.5 ${
                      expanded
                        ? "bg-white/[.07] text-white"
                        : groupActive
                          ? "bg-[var(--admin-primary-soft)] text-white shadow-[inset_0_-2px_0_var(--admin-primary)]"
                          : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-200"
                    }`}
                    aria-haspopup="true"
                    aria-expanded={expanded}
                    aria-current={groupActive ? "page" : undefined}
                    onClick={() => {
                      if (expanded) {
                        closeMegaMenu();
                      } else {
                        setOpenGroupBoth(group.id);
                      }
                    }}
                  >
                    <span className="truncate hidden md:inline">{group.label}</span>
                    <ChevronDownIcon open={expanded} className="h-3.5 w-3.5 text-zinc-500" />
                  </button>
                </div>
              );
            })}

            {overflowGroups.length > 0 && (
              <div className="relative shrink-0" ref={overflowRef}>
                <button
                  type="button"
                  className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-all duration-200 ${
                    overflowOpen
                      ? "bg-white/[.07] text-white"
                      : overflowGroups.some((group) => group.id === activeGroupId)
                        ? "bg-[var(--admin-primary-soft)] text-white shadow-[inset_0_-2px_0_var(--admin-primary)]"
                        : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-200"
                  }`}
                  onClick={() => setOverflowOpen((current) => !current)}
                  aria-haspopup="true"
                  aria-expanded={overflowOpen}
                  aria-current={overflowGroups.some((group) => group.id === activeGroupId) ? "page" : undefined}
                >
                  <span className="hidden md:inline">Más</span>
                  <ChevronDownIcon open={overflowOpen} className="h-3.5 w-3.5 text-zinc-500" />
                </button>
                {overflowOpen && (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-48 overflow-hidden rounded-xl border border-white/[.06] bg-zinc-950/95 shadow-xl shadow-black/20 backdrop-blur-xl">
                    {overflowGroups.map((group) => {
                      const groupActive = activeGroupId === group.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                            groupActive
                              ? "bg-white/[.05] text-white"
                              : "text-zinc-400 hover:bg-white/[.03] hover:text-zinc-200"
                          }`}
                          onClick={() => {
                            setOverflowOpen(false);
                            setOpenGroupBoth(group.id);
                          }}
                        >
                          <span className="text-xs font-black text-[var(--admin-primary-strong)]">{group.icon}</span>
                          <span className="truncate">{group.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 xl:gap-2">
            <BranchSwitcher
                  branches={branches}
                  activeBranchId={activeBranchId}
                  activeBranchName={activeBranch?.name}
                  consolidatedAvailable={allBranches}
                  compact
                />

            <button
              type="button"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition-all duration-200 hover:bg-white/[.05] hover:text-zinc-200"
              onClick={() => {
                setCommandOpen(true);
                setMobileMenuPath(null);
              }}
              aria-label="Buscar (Ctrl K)"
              title="Buscar (Ctrl K)"
            >
              <SearchIcon />
              <span className="hidden lg:inline">Buscar</span>
              <kbd className="hidden h-5 items-center rounded-md border border-white/10 bg-white/[.03] px-1.5 font-sans text-[10px] font-medium text-zinc-500 2xl:flex">
                Ctrl K
              </kbd>
            </button>

            {permissions.includes("notification.manage") && <NotificationCenter compact />}

            <a
              href={publicSite}
              target="_blank"
              rel="noreferrer"
              aria-label="Ver sitio"
              title="Ver sitio"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition-all duration-200 hover:bg-white/[.05] hover:text-zinc-200"
            >
              <ExternalIcon />
              <span className="hidden lg:inline">Ver sitio</span>
            </a>

            {isSuperAdmin && (
              <Link
                href={platformAdminPath()}
                aria-label="Ir a la plataforma"
                title="Ir a la plataforma"
                className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-amber-300/90 transition-all duration-200 hover:bg-amber-500/[.06] sm:flex"
              >
                <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-500/12 text-[8px] font-black text-amber-300">
                  SA
                </span>
                <span className="hidden lg:inline">Plataforma</span>
              </Link>
            )}

            {permissions.includes("support.manage") && (
              <Link
                href={adminHref("/admin/soporte")}
                aria-label="Soporte"
                title="Soporte"
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition-all duration-200 hover:bg-white/[.05] hover:text-zinc-200"
              >
                <HelpIcon />
                <span className="hidden lg:inline">Soporte</span>
              </Link>
            )}

            <ProfileMenu
              userName={userName}
              userEmail={userEmail}
              userImageUrl={userImageUrl}
              tenantName={tenantName}
              adminHref={adminHref}
              onLogout={logout}
              helpHref={permissions.includes("support.manage") ? adminHref("/admin/soporte") : undefined}
              onSwitchNavigationMode={() => setNavigationMode((current) => (current === "TOP" ? "SIDEBAR" : "TOP"))}
              currentMode={navigationMode}
            />
          </div>
        </div>
      </header>

      {activeGroup && (
          <div
            ref={megaPanelRef}
            className="fixed inset-x-0 top-14 z-40 flex justify-center mega-panel-enter print:hidden"
            role="region"
            aria-label={`Secciones de ${activeGroup.label}`}
            onKeyDown={(event) =>
            handlePanelKeyDown(
              event,
              activeGroup.sections.flatMap((section) => [...section.items]),
            )
          }
          onBlur={handlePanelBlur}
        >
          <div className="admin-shell-inner mx-auto w-full max-w-7xl overflow-hidden border-b border-white/[.06] bg-zinc-900/95 shadow-2xl shadow-black/30 backdrop-blur-2xl">
            <div className="flex items-center gap-3 px-5 py-3.5 sm:px-7 sm:py-4">
              <h2 className="text-sm font-semibold text-white">{activeGroup.label}</h2>
              {activeGroup.description && (
                <p className="truncate text-xs text-zinc-500">{activeGroup.description}</p>
              )}
            </div>
            <div className="flex max-h-[70vh] overflow-hidden overscroll-contain">
              <nav className="w-48 shrink-0 overflow-y-auto overscroll-contain border-r border-white/[.04] py-2 sm:w-56 admin-custom-scroll" aria-label="Subsecciones">
                {activeGroup.sections.map((section) => {
                  const isActive = activeSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={`mega-section-btn group flex w-full items-center gap-2.5 rounded-lg px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                        isActive
                          ? "bg-white/[.06] font-medium text-white"
                          : "text-zinc-400 hover:bg-white/[.03] hover:text-zinc-200"
                      }`}
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      <span className={`mega-accent-bar${isActive ? " is-active" : ""}`} aria-hidden="true" />
                      {section.label}
                    </button>
                  );
                })}
              </nav>

              <div className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 admin-custom-scroll">
                {(() => {
                  const activeSection = activeGroup.sections.find((s) => s.id === activeSectionId) ?? activeGroup.sections[0];
                  if (!activeSection) return null;
                  let flatIndex = 0;
                  for (const s of activeGroup.sections) {
                    if (s.id === activeSection.id) break;
                    flatIndex += s.items.length;
                  }
                  return (
                    <div>
                      <h3 className="mb-3.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        {activeSection.label}
                      </h3>
                      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {activeSection.items.map((item) => {
                          const index = flatIndex++;
                          const active = activeLink?.href === item.href;
                          const restricted = Boolean(
                            item.accessPermission && !permissions.includes(item.accessPermission),
                          );
                          return (
                            <Link
                              key={item.href}
                              ref={(element) => {
                                panelItemRefs.current[index] = element;
                              }}
                              href={adminHref(item.href)}
                              aria-label={item.label}
                              aria-current={active ? "page" : undefined}
                              tabIndex={panelFocusIndex === -1 || panelFocusIndex === index ? 0 : -1}
                              onClick={(event) => {
                                if (restricted) {
                                  event.preventDefault();
                                  void showDriverPanelAccessNotice();
                                  return;
                                }
                                setOpenGroupBoth(null);
                                setMobileMenuPath(null);
                              }}
                              className={`mega-item group flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all duration-200 ${
                                active ? "bg-white/[.06]" : "hover:bg-white/[.03]"
                              }`}
                            >
                              <span
                                className={`mega-accent-bar shrink-0 ${active ? "is-active" : ""}`}
                                aria-hidden="true"
                              />
                              <span
                                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black tracking-wider transition-all duration-200 ${
                                  active
                                    ? "bg-[var(--admin-primary-strong)]/12 text-[var(--admin-primary-strong)]"
                                    : "bg-white/[.03] text-zinc-500 group-hover:bg-white/[.05] group-hover:text-zinc-300"
                                }`}
                              >
                                {item.icon}
                              </span>
                              <span className="min-w-0">
                                <span
                                  className={`block text-sm font-medium leading-snug transition-colors duration-200 ${
                                    active ? "text-white" : "text-zinc-300 group-hover:text-zinc-100"
                                  }`}
                                >
                                  {item.label}
                                </span>
                                {item.description && (
                                  <span className="mt-0.5 block text-xs leading-snug text-zinc-500">
                                    {item.description}
                                  </span>
                                )}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="admin-main admin-shell-inner px-3 pb-5 pt-[4.75rem] sm:px-4 sm:pb-6 sm:pt-20 lg:px-0 lg:pb-8 lg:pt-[5.5rem]">{children}</main>

      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuPath(null)}
            aria-hidden="true"
          />
          <div
            id="admin-navigation-panel"
            className="fixed inset-y-0 left-0 z-[200] flex h-dvh w-[min(20rem,88vw)] max-w-full flex-col border-r border-white/[.08] bg-zinc-950 shadow-2xl shadow-black/50 mobile-drawer-enter lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de administración"
          >
            <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[.08] px-5 py-4 pt-[env(safe-area-inset-top)]">
              <div className="flex min-w-0 items-center gap-3.5">
                <UserAvatar
                  name={userName?.trim() || tenantName}
                  src={userImageUrl}
                  className="h-10 w-10 text-sm"
                />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-white">
                    {userName?.trim() || tenantName}
                  </strong>
                  <small className="block truncate text-xs text-zinc-500">
                    {userEmail || tenantName}
                  </small>
                </span>
              </div>
              <button
                ref={mobileCloseButtonRef}
                type="button"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
                onClick={() => setMobileMenuPath(null)}
                aria-label="Cerrar navegación"
                title="Cerrar navegación"
              >
                ×
              </button>
            </div>

            <div className="grid gap-3 border-b border-white/[.08] px-4 py-4">
              <button
                type="button"
                className="flex h-12 w-full items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-4 text-base font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
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
              className="flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
              aria-label="Secciones administrativas"
            >
              {accessibleGroups.map((group) => {
                const expanded = mobileExpanded === group.id;
                const containsActive = activeGroupId === group.id;
                return (
                  <section
                    key={group.id}
                    className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                      containsActive
                        ? "border-white/[.1] bg-white/[.03]"
                        : "border-white/[.06] bg-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={group.label}
                      className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-all duration-200 hover:bg-white/[.04]"
                      aria-controls={`mobile-admin-group-${group.id}`}
                      aria-expanded={expanded}
                      onClick={() => setMobileExpanded((current) => (current === group.id ? null : group.id))}
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-black tracking-wider transition-all duration-200 ${
                          containsActive ? "bg-[var(--admin-primary-strong)]/15 text-[var(--admin-primary-strong)]" : "bg-white/[.04] text-zinc-500"
                        }`}
                      >
                        {group.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong
                          className={`block truncate text-sm font-semibold ${
                            containsActive ? "text-white" : "text-zinc-300"
                          }`}
                        >
                          {group.label}
                        </strong>
                      </span>
                      <ChevronDownIcon open={expanded} className="text-zinc-600" />
                    </button>
                    {expanded && (
                      <div
                        id={`mobile-admin-group-${group.id}`}
                        className="space-y-1 border-t border-white/[.06] px-3 py-3"
                      >
                        {group.sections.map((section) => (
                          <div key={section.id}>
                            <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                              {section.label}
                            </h3>
                            <div className="space-y-1">
                              {section.items.map((item) => {
                                const active = activeLink?.href === item.href;
                                const restricted = Boolean(
                                  item.accessPermission && !permissions.includes(item.accessPermission),
                                );
                                return (
                                  <Link
                                    key={item.href}
                                    href={adminHref(item.href)}
                                    aria-label={item.label}
                                    aria-current={active ? "page" : undefined}
                                    onClick={(event) => {
                                      if (restricted) {
                                        event.preventDefault();
                                        void showDriverPanelAccessNotice();
                                        return;
                                      }
                                      setMobileMenuPath(null);
                                    }}
                                    className={`flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all duration-200 ${
                                      active ? "bg-white/[.06] border-l-2 border-[var(--admin-primary-strong)] pl-3" : "hover:bg-white/[.04] border-l-2 border-transparent"
                                    }`}
                                  >
                                    <span
                                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-black tracking-wider transition-all duration-200 ${
                                        active
                                          ? "bg-[var(--admin-primary-strong)]/15 text-[var(--admin-primary-strong)]"
                                          : "bg-white/[.04] text-zinc-500"
                                      }`}
                                    >
                                      {item.icon}
                                    </span>
                                    <span className="min-w-0">
                                      <span
                                        className={`block truncate text-sm font-medium transition-colors duration-200 ${
                                          active ? "text-white" : "text-zinc-300"
                                        }`}
                                      >
                                        {item.label}
                                      </span>
                                      {item.description && (
                                        <span className="mt-0.5 block truncate text-xs text-zinc-500">
                                          {item.description}
                                        </span>
                                      )}
                                    </span>
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
                  className="flex items-center gap-3.5 rounded-2xl border border-amber-500/15 bg-amber-500/[.04] px-4 py-3.5 text-base font-medium text-amber-300 transition-all duration-200 hover:bg-amber-500/[.08]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-xs font-black">
                    SA
                  </span>
                  Plataforma
                </Link>
              )}

              {permissions.includes("support.manage") && (
                <Link
                  href={adminHref("/admin/soporte")}
                  onClick={() => setMobileMenuPath(null)}
                  className="flex items-center gap-3.5 rounded-2xl border border-white/[.08] bg-white/[.03] px-4 py-3.5 text-base font-medium text-zinc-300 transition-all duration-200 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.05] text-xs font-black text-zinc-500">
                    <HelpIcon />
                  </span>
                  Soporte
                </Link>
              )}
            </nav>

            <div className="grid gap-3 border-t border-white/[.08] p-4">
              <a
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-white/[.08] bg-white/[.03] px-3 text-base font-medium text-zinc-300 transition-all duration-200 hover:bg-white/[.06] hover:text-white"
                href={`${publicSite}/carta`}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalIcon />
                Ver carta
              </a>
              <button
                type="button"
                onClick={logout}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-red-500/15 bg-red-500/[.04] px-3 text-base font-medium text-red-300 transition-all duration-200 hover:bg-red-500/10"
              >
                <LogoutIcon />
                Cerrar sesión
              </button>
            </div>
          </div>
        </>
      )}

        </>
      )}

      {commandOpen && (
        <div
          className="fixed inset-0 z-[150] grid place-items-start bg-black/80 p-4 pt-[10vh] backdrop-blur"
          onClick={closeCommand}
        >
          <section
            className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Búsqueda global"
          >
             <label className="block border-b border-white/10 p-4">
               <span className="sr-only">Buscar en todo el panel</span>
               <SearchBox
                 value={commandQuery}
                 onChange={(value) => {
                   setCommandQuery(value);
                   setCommandActive(0);
                 }}
                 placeholder="Buscá pedidos, clientes, reservas, productos o secciones…"
                 className="text-xl font-bold"
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
                       if (target.restricted) {
                         void showDriverPanelAccessNotice();
                       } else {
                         router.push(target.href);
                         closeCommand();
                       }
                     }
                   } else if (event.key === "Escape") {
                     closeCommand();
                   }
                 }}
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
                          className={`flex items-center gap-3 rounded-xl p-3 transition-colors duration-150 ${
                            active ? "bg-pink-500/10 ring-1 ring-pink-500/30" : "hover:bg-white/5"
                          }`}
                          href={item.href}
                          key={item.key}
                          onMouseEnter={() =>
                            setCommandActive(commandItems.findIndex((entry) => entry.key === item.key))
                          }
                          onClick={(event) => {
                            if (item.restricted) {
                              event.preventDefault();
                              void showDriverPanelAccessNotice();
                              return;
                            }
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
