"use client";

import type { Route } from "next";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/admin/ui/icons";
import { UserAvatar } from "@/components/admin/ui/avatar";

/** @summary Resuelve la URL pública del avatar a partir del nombre de archivo almacenado. */
export function avatarUrl(imageUrl?: string) {
  const value = imageUrl?.trim();
  if (!value || value === "avatar_profile_default.png") return null;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) return value;
  return `/images/images_profile/${value}`;
}

function ChevronDownIcon({ open = false, className = "" }: { open?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""} ${className}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
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

type ProfileMenuProps = {
  userName?: string;
  userEmail?: string;
  userImageUrl?: string;
  tenantName: string;
  adminHref: (href: string) => Route;
  onLogout: () => void;
  helpHref?: Route;
  onSwitchNavigationMode?: () => void;
  currentMode?: "TOP" | "SIDEBAR";
  /** @summary Cuando true, el dropdown se abre hacia la derecha (para sidebar rail). */
  sidebarMode?: boolean;
  /** @summary Cuando true, solo muestra el avatar centrado (para rail compacto). */
  compact?: boolean;
};

/**
 * @summary Calcula la posición del popover para que siempre quede dentro del viewport.
 *
 * Intenta abrir a la derecha y hacia arriba del botón. Si no cabe, ajusta.
 */
function computePopoverPosition(buttonRect: DOMRect): { top: number; left: number } {
  const POPOVER_W = 272;
  const POPOVER_H = 320;
  const GAP = 8;
  const MARGIN = 12;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Intentar a la derecha del botón, alineado arriba
  let left = buttonRect.right + GAP;
  let top = buttonRect.top;

  // Si no cabe a la derecha, abrir a la izquierda
  if (left + POPOVER_W > vw - MARGIN) {
    left = buttonRect.left - GAP - POPOVER_W;
  }
  // Si tampoco cabe a la izquierda, centrar
  if (left < MARGIN) {
    left = Math.max(MARGIN, (vw - POPOVER_W) / 2);
  }

  // Si no cabe hacia abajo, abrir hacia arriba
  if (top + POPOVER_H > vh - MARGIN) {
    top = vh - MARGIN - POPOVER_H;
  }
  // Si no cabe hacia arriba, alinear al tope
  if (top < MARGIN) {
    top = MARGIN;
  }

  return { top, left };
}

/** @summary Menú de perfil como popover flotante con Portal. */
export function ProfileMenu({
  userName,
  userEmail,
  userImageUrl,
  tenantName,
  adminHref,
  onLogout,
  helpHref,
  onSwitchNavigationMode,
  currentMode,
  sidebarMode = false,
  compact = false,
}: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const displayName = userName?.trim() || tenantName;
  const avatarSrc = avatarUrl(userImageUrl);

  const menuItems = useMemo(
    () => [
      ...(helpHref ? [{ key: "help", label: "Soporte" }] : []),
      { key: "profile", label: "Mi perfil" },
      ...(onSwitchNavigationMode
        ? [
            {
              key: "mode",
              label: currentMode === "TOP" ? "Modo barra lateral" : "Modo barra superior",
            },
          ]
        : []),
      { key: "logout", label: "Cerrar sesión", danger: true },
    ],
    [helpHref, onSwitchNavigationMode, currentMode],
  );

  /** @summary Calcula posición al abrir y registra listeners de cierre. */
  useEffect(() => {
    if (!open) return;

    // Calcular posición del popover
    if (buttonRef.current) {
      setPopoverPos(computePopoverPosition(buttonRef.current.getBoundingClientRect()));
    }

    function handlePointer(event: PointerEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setFocusIndex(-1);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setFocusIndex(-1);
        buttonRef.current?.focus();
      }
    }
    function handleResize() {
      if (buttonRef.current) {
        setPopoverPos(computePopoverPosition(buttonRef.current.getBoundingClientRect()));
      }
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  const toggle = useCallback(() => {
    setOpen((c) => !c);
    setFocusIndex(-1);
  }, []);

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

  const popoverContent = (
    <div
      ref={popoverRef}
      className="dropdown-enter fixed z-[250] w-[288px] overflow-hidden rounded-xl border border-[var(--admin-border-strong)] bg-[var(--admin-surface-overlay)] p-1.5 shadow-2xl shadow-black/40 backdrop-blur-xl"
      style={{ top: popoverPos.top, left: popoverPos.left }}
      role="menu"
      aria-label="Menú de perfil"
      onKeyDown={handleMenuKeyDown}
    >
      {/* Header: avatar + info */}
      <div className="flex items-center gap-3 rounded-lg px-3 py-3">
        <UserAvatar
          name={displayName}
          src={avatarSrc}
          size="md"
          status="online"
          className="text-sm shrink-0 ring-1 ring-white/10 shadow-[var(--admin-shadow-sm)]"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{displayName}</p>
          <p className="truncate text-xs text-zinc-500">{userEmail || tenantName}</p>
          <p className="mt-0.5 text-[10px] font-semibold text-emerald-300">Sesión activa</p>
        </div>
      </div>
      <div className="mx-2 my-1 h-px bg-white/[.06]" />
      {/* Menu items */}
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
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.05] text-sm font-black text-zinc-400">
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
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.05] text-sm font-black text-zinc-400">
                <Icon name="user" className="h-4 w-4" />
              </span>
              Mi perfil
            </Link>
          );
        }
        if (entry.key === "mode" && onSwitchNavigationMode) {
          return (
            <button
              key={entry.key}
              type="button"
              role="menuitem"
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              tabIndex={tabIndex}
              onClick={() => {
                onSwitchNavigationMode();
                setOpen(false);
                setFocusIndex(-1);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[.05] text-sm font-black text-zinc-400">
                <Icon name={currentMode === "TOP" ? "menu" : "arrow-left"} className="h-4 w-4" />
              </span>
              {currentMode === "TOP" ? "Modo barra lateral" : "Modo barra superior"}
            </button>
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
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-300 transition-colors duration-150 hover:bg-red-500/10"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-500/10 text-sm font-black">
              <Icon name="logout" className="h-4 w-4" />
            </span>
            Cerrar sesión
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        className={`flex h-9 items-center gap-2 rounded-full py-1 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white ${compact ? "justify-center px-1" : sidebarMode ? "justify-center px-1" : "pl-1 pr-2.5"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de perfil"
        onClick={toggle}
      >
        <UserAvatar
          name={displayName}
          src={avatarSrc}
          size="sm"
          status="online"
          className="ring-1 ring-white/10 shadow-[var(--admin-shadow-sm)]"
        />
        {!compact && <span className="hidden max-w-20 truncate 2xl:block">{tenantName}</span>}
        {!compact && <ChevronDownIcon open={open} className="hidden text-zinc-500 2xl:block" />}
      </button>
      {open && typeof document !== "undefined" && createPortal(popoverContent, document.body)}
    </div>
  );
}
