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

/**
 * @summary Resuelve la URL pública del avatar a partir del nombre de archivo almacenado.
 * Los valores vacíos o el placeholder por defecto se tratan como "sin foto".
 */
function avatarUrl(imageUrl?: string) {
  const value = imageUrl?.trim();
  if (!value || value === "avatar_profile_default.png") return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/images/images_profile/${value}`;
}

/** @summary Avatar circular con foto real y fallback a iniciales si no hay imagen. */
function UserAvatar({
  name,
  imageUrl,
  className = "",
}: {
  name: string;
  imageUrl?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = avatarUrl(imageUrl);
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${className || "h-8 w-8"} rounded-full object-cover ring-1 ring-white/10`}
      />
    );
  }
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U";
  return (
    <span
      className={`${className || "h-8 w-8"} grid place-items-center rounded-full bg-pink-500/10 text-[11px] font-black text-pink-300`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
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

/**
 * @summary Menú de perfil de la barra superior: identidad, cuenta y cierre de sesión.
 * Soporta foto de usuario (o iniciales), navegación con teclado, Escape y click afuera.
 */
function ProfileMenu({
  userName,
  userEmail,
  userImageUrl,
  tenantName,
  adminHref,
  onLogout,
  helpHref,
}: {
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
  tenantName: string;
  adminHref: (href: string) => Route;
  onLogout: () => void;
  helpHref?: Route;
}) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const displayName = userName?.trim() || tenantName;
  const menuItems: Array<{ key: string; label: string; danger?: boolean }> = [
    ...(helpHref ? [{ key: "help", label: "Soporte" }] : []),
    { key: "profile", label: "Mi perfil" },
    { key: "logout", label: "Cerrar sesión", danger: true },
  ];

  useEffect(() => {
    if (!open) return;
    /**
     * @summary Cierra el menú al interactuar fuera de él o con Escape.
     */
    function handlePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setFocusIndex(-1);
      }
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  /** @summary Navegación con teclado dentro del menú (flechas, Inicio, Fin). */
  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (menuItems.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      let next = focusIndex;
      if (event.key === "ArrowDown") next += 1;
      else if (event.key === "ArrowUp") next -= 1;
      else if (event.key === "Home") next = 0;
      else next = menuItems.length - 1;
      next = Math.max(0, Math.min(menuItems.length - 1, next));
      setFocusIndex(next);
      itemRefs.current[next]?.focus();
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex h-9 items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de perfil"
        onClick={() => setOpen((current) => !current)}
      >
        <UserAvatar name={displayName} imageUrl={userImageUrl} />
        <span className="hidden max-w-20 truncate 2xl:block">{tenantName}</span>
        <ChevronDownIcon open={open} className="hidden text-zinc-500 2xl:block" />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-xl shadow-black/25 backdrop-blur-xl"
          role="menu"
          aria-label="Menú de perfil"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="flex items-center gap-3 rounded-xl px-3 py-3">
            <UserAvatar name={displayName} imageUrl={userImageUrl} className="h-10 w-10 text-sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-zinc-500">{userEmail || tenantName}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-white/[.07]" />
          {menuItems.map((entry, index) => {
            const tabIndex = focusIndex === -1 || focusIndex === index ? 0 : -1;
            if (entry.key === "help" && helpHref) {
              return (
                <Link
                  key={entry.key}
                  role="menuitem"
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  href={helpHref}
                  tabIndex={tabIndex}
                  onClick={() => {
                    setOpen(false);
                    setFocusIndex(-1);
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.05] text-[10px] font-black text-zinc-400">
                    <HelpIcon />
                  </span>
                  Soporte
                </Link>
              );
            }
            if (entry.key === "profile") {
              return (
                <Link
                  key={entry.key}
                  role="menuitem"
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  href={adminHref("/admin/cuenta")}
                  tabIndex={tabIndex}
                  onClick={() => {
                    setOpen(false);
                    setFocusIndex(-1);
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/[.05] text-[10px] font-black text-zinc-400">
                    MC
                  </span>
                  Mi perfil
                </Link>
              );
            }
            return (
              <button
                key={entry.key}
                type="button"
                role="menuitem"
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                tabIndex={tabIndex}
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-red-300 transition-colors duration-150 hover:bg-red-500/10"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-red-500/10 text-[10px] font-black">
                  <LogoutIcon />
                </span>
                Cerrar sesión
              </button>
            );
          })}
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
  userName,
  userEmail,
  userImageUrl,
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
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
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
        className="sticky top-0 z-50 border-b border-white/[.08] bg-zinc-950/80 backdrop-blur-xl print:hidden"
      >
        <div className="admin-shell-inner flex h-16 items-center gap-2 sm:gap-3">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white lg:hidden"
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
            <span aria-hidden="true">{mobileMenuOpen ? "×" : "☰"}</span>
          </button>

          <Link
            href={adminHref("/admin")}
            className="flex shrink-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-white/[.04]"
            onClick={() => {
              setOpenGroup(null);
              setMobileMenuPath(null);
            }}
          >
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[var(--admin-primary-strong)] text-xs font-black text-white">
              {tenantInitials(tenantName)}
            </span>
            <span className="hidden min-w-0 leading-tight sm:block">
              <strong className="block max-w-28 truncate text-sm font-semibold text-white xl:max-w-32">
                {tenantName}
              </strong>
              <small className="block text-[9px] font-bold uppercase tracking-[.16em] text-zinc-500">
                Administración
              </small>
            </span>
          </Link>

          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 lg:flex xl:gap-1"
            aria-label="Secciones administrativas"
            onMouseLeave={scheduleCloseGroup}
          >
            {accessibleGroups.map((group) => {
              const groupActive = activeGroupId === group.id;
              const expanded = openGroup === group.id;
              return (
                <div
                  key={group.id}
                  className="shrink-0"
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
                    className={`flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-sm transition-colors duration-150 xl:px-3 ${
                      expanded || groupActive
                        ? "bg-white/[.06] text-white"
                        : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-100"
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
                    <ChevronDownIcon open={expanded} className="text-zinc-600" />
                  </button>
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5 xl:gap-2">
            <div className="hidden md:block">
              {branchNavigationAvailable && (
                <BranchSwitcher
                  branches={branches}
                  activeBranchId={activeBranchId}
                  activeBranchName={activeBranch?.name}
                  consolidatedAvailable={allBranches}
                  compact
                />
              )}
            </div>

            <button
              type="button"
              className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[.05] hover:text-zinc-100"
              onClick={() => {
                setCommandOpen(true);
                setMobileMenuPath(null);
              }}
              aria-label="Buscar (Ctrl K)"
              title="Buscar (Ctrl K)"
            >
              <SearchIcon />
              <span className="hidden xl:inline">Buscar</span>
              <kbd className="hidden h-5 items-center rounded border border-white/10 bg-white/[.04] px-1.5 font-sans text-[10px] font-medium text-zinc-500 2xl:flex">
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
              className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[.05] hover:text-zinc-100"
            >
              <ExternalIcon />
              <span className="hidden xl:inline">Ver sitio</span>
            </a>

            {isSuperAdmin && (
              <Link
                href={platformAdminPath()}
                aria-label="Ir a la plataforma"
                title="Ir a la plataforma"
                className="hidden h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-amber-300/90 transition-colors duration-150 hover:bg-amber-500/[.08] sm:flex"
              >
                <span className="grid h-5 w-5 place-items-center rounded-md bg-amber-500/15 text-[8px] font-black text-amber-300">
                  SA
                </span>
                <span className="hidden xl:inline">Plataforma</span>
              </Link>
            )}

            {permissions.includes("support.manage") && (
              <Link
                href={adminHref("/admin/soporte")}
                aria-label="Soporte"
                title="Soporte"
                className="flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-zinc-400 transition-colors duration-150 hover:bg-white/[.05] hover:text-zinc-100"
              >
                <HelpIcon />
                <span className="hidden xl:inline">Soporte</span>
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
            />
          </div>
        </div>
      </header>

      {activeGroup && (
        <div
          ref={megaPanelRef}
          className="fixed inset-x-0 top-16 z-40 flex justify-center print:hidden"
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
          <div className="admin-shell-inner w-full overflow-hidden rounded-b-2xl border border-t-0 border-white/[.08] bg-[var(--admin-surface)] shadow-2xl shadow-black/20">
            <div className="flex items-baseline gap-3 border-b border-white/[.06] px-8 py-5">
              <h2 className="text-sm font-bold text-white">{activeGroup.label}</h2>
              <p className="truncate text-xs text-zinc-500">{activeGroup.description}</p>
            </div>
            <div
              className={`grid gap-x-14 gap-y-9 px-8 py-7 ${megaMenuColumns(activeGroup.sections.length)}`}
            >
              {(() => {
                let flatIndex = 0;
                return activeGroup.sections.map((section) => (
                  <section key={section.id} className="min-w-0">
                    <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      {section.label}
                    </h3>
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
                            className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 ${
                              active ? "bg-white/[.06]" : "hover:bg-white/[.04]"
                            }`}
                          >
                            <span
                              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black tracking-wider transition-colors duration-150 ${
                                active
                                  ? "bg-pink-500/15 text-pink-300"
                                  : "bg-white/[.05] text-zinc-500 group-hover:text-zinc-300"
                              }`}
                            >
                              {item.icon}
                            </span>
                            <span className="min-w-0">
                              <span
                                className={`block truncate text-sm font-medium transition-colors duration-150 ${
                                  active ? "text-white" : "text-zinc-300 group-hover:text-white"
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
                  </section>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      <main className="admin-main admin-shell-inner py-6 lg:py-8">{children}</main>

      {mobileMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-[190] bg-black/70 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuPath(null)}
            aria-hidden="true"
          />
          <div
            id="admin-navigation-panel"
            className="fixed inset-y-0 left-0 z-[200] flex h-dvh w-[min(20rem,88vw)] max-w-full flex-col border-r border-white/[.08] bg-zinc-950 shadow-2xl shadow-black/50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menú de administración"
          >
            <div className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[.08] px-4 py-3.5 pt-[env(safe-area-inset-top)]">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  name={userName?.trim() || tenantName}
                  imageUrl={userImageUrl}
                  className="h-9 w-9 text-xs"
                />
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-white">
                    {userName?.trim() || tenantName}
                  </strong>
                  <small className="block truncate text-[11px] text-zinc-500">
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

            <div className="grid gap-2 border-b border-white/[.08] px-3 py-3">
              <button
                type="button"
                className="flex h-11 w-full items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-4 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
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
                    className={`overflow-hidden rounded-xl border transition-colors duration-150 ${
                      containsActive
                        ? "border-white/[.1] bg-white/[.03]"
                        : "border-white/[.06] bg-transparent"
                    }`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-white/[.04]"
                      aria-controls={`mobile-admin-group-${group.id}`}
                      aria-expanded={expanded}
                      onClick={() => setMobileExpanded((current) => (current === group.id ? null : group.id))}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black tracking-wider transition-colors duration-150 ${
                          containsActive ? "bg-pink-500/15 text-pink-300" : "bg-white/[.05] text-zinc-500"
                        }`}
                      >
                        {group.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong
                          className={`block truncate text-sm font-medium ${
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
                        className="space-y-4 border-t border-white/[.06] p-3"
                      >
                        {group.sections.map((section) => (
                          <div key={section.id}>
                            <h3 className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
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
                                    className={`flex items-start gap-3 rounded-lg px-2.5 py-2.5 transition-colors duration-150 ${
                                      active ? "bg-white/[.06]" : "hover:bg-white/[.04]"
                                    }`}
                                  >
                                    <span
                                      className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-black tracking-wider transition-colors duration-150 ${
                                        active
                                          ? "bg-pink-500/15 text-pink-300"
                                          : "bg-white/[.05] text-zinc-500"
                                      }`}
                                    >
                                      {item.icon}
                                    </span>
                                    <span className="min-w-0">
                                      <span
                                        className={`block truncate text-sm font-medium transition-colors duration-150 ${
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
                  className="flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-500/[.04] px-3 py-3 text-sm font-medium text-amber-300 transition-colors duration-150 hover:bg-amber-500/[.08]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-500/10 text-[9px] font-black">
                    SA
                  </span>
                  Plataforma
                </Link>
              )}

              {permissions.includes("support.manage") && (
                <Link
                  href={adminHref("/admin/soporte")}
                  onClick={() => setMobileMenuPath(null)}
                  className="flex items-center gap-3 rounded-xl border border-white/[.08] bg-white/[.03] px-3 py-3 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/[.05] text-[9px] font-black text-zinc-500">
                    <HelpIcon />
                  </span>
                  Soporte
                </Link>
              )}
            </nav>

            <div className="grid gap-2 border-t border-white/[.08] p-3">
              <a
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[.08] bg-white/[.03] px-3 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[.04] px-3 text-sm font-medium text-red-300 transition-colors duration-150 hover:bg-red-500/10"
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
            className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl"
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
                          className={`flex items-center gap-3 rounded-xl p-3 transition-colors duration-150 ${
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
