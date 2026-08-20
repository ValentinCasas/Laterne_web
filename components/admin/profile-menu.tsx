"use client";

import type { Route } from "next";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
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

/** @summary Menú de perfil compartido entre barra superior y barra lateral. */
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
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (!open) return;
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

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (menuItems.length === 0) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Home" ||
      event.key === "End"
    ) {
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
        className={`flex h-9 items-center gap-2 rounded-full py-1 text-sm font-medium text-zinc-300 transition-colors duration-150 hover:bg-white/[.06] hover:text-white ${compact ? "justify-center px-1" : sidebarMode ? "justify-center px-1" : "pl-1 pr-2.5"}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de perfil"
        onClick={() => setOpen((current) => !current)}
      >
        <UserAvatar name={displayName} src={avatarSrc} size="sm" className="ring-1 ring-white/10 shadow-[2px_2px_6px_rgba(0,0,0,0.45),-1px_-1px_4px_rgba(255,255,255,0.03),inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
        {!compact && <span className="hidden max-w-20 truncate 2xl:block">{tenantName}</span>}
        {!compact && <ChevronDownIcon open={open} className="hidden text-zinc-500 2xl:block" />}
      </button>
      {open && (
        <div
          className={`${sidebarMode ? "left-full top-0 ml-2" : "right-0 top-full mt-3"} absolute z-50 w-72 overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-900/95 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl dropdown-enter`}
          role="menu"
          aria-label="Menú de perfil"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="flex items-center gap-3.5 rounded-xl px-4 py-4">
            <UserAvatar name={displayName} src={avatarSrc} size="md" className="text-sm shadow-[3px_3px_8px_rgba(0,0,0,0.5),-1px_-1px_5px_rgba(255,255,255,0.03),inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-zinc-500">{userEmail || tenantName}</p>
            </div>
          </div>
          <div className="my-2 h-px bg-white/[.07]" />
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
                  className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.05] text-sm font-black text-zinc-400">
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
                  className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.05] text-sm font-black text-zinc-400">
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
                  className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-sm font-medium text-zinc-300 transition-all duration-200 hover:bg-white/[.06] hover:text-white"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.05] text-sm font-black text-zinc-400">
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
                className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-sm font-medium text-red-300 transition-all duration-200 hover:bg-red-500/10"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-500/10 text-sm font-black">
                  <Icon name="logout" className="h-4 w-4" />
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
