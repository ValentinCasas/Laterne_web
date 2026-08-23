"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";
import { EmptyState } from "@/components/admin/ui";

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** @summary Ícono de campana monocromo para la barra superior. */
function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

/** @summary Marca de tipo para la lista: usa la inicial del tipo con un acento sutil. */
function typeGlyph(type: string) {
  return (type.trim().charAt(0) || "N").toUpperCase();
}

/** @summary Fecha relativa corta (hace 2 min, hace 3 h, hace 2 días…). */
function relativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? "Hace 1 día" : `Hace ${days} días`;
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

/**
 * @summary Bloquea el scroll del body sin causar layout shift.
 *
 * Calcula el ancho real de la scrollbar y aplica un padding-right
 * compensatorio para que la página no se desplace horizontalmente.
 */
function lockBodyScroll() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.style.overflow = "hidden";
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function unlockBodyScroll() {
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
}

/**
 * @summary Centro de notificaciones con modal portal.
 *
 * Renderiza el botón de campana en el navbar/sidebar y el panel modal
 * mediante React Portal hacia document.body para que sea totalmente
 * independiente del layout de la aplicación.
 */
export function NotificationCenter({
  compact = false,
  sidebarMode = false,
}: {
  compact?: boolean;
  sidebarMode?: boolean;
}) {
  const pathname = usePathname();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await scopedFetch("/api/admin/notifications");
        if (!response.ok) return;
        const result = (await response.json()) as {
          notifications: AdminNotification[];
          unread: number;
        };
        if (active) {
          setItems(result.notifications);
          setUnread(result.unread);
        }
      } catch {
        // Sin conexión o sesión expirada: se conserva el estado actual.
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  /** @summary Bloquea scroll del body al abrir el modal. */
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  /** @summary Cierra con Escape y click afuera. Devuelve focus al botón al cerrar. */
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function handlePointer(event: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointer);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointer);
    };
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  /** @summary Marca los avisos pendientes como leídos y actualiza su apariencia local. */
  async function readAll() {
    await scopedFetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnread(0);
  }

  const notificationPanelContent = (
    <>
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-white">Notificaciones</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {unread > 0 ? `${unread} sin leer` : "Estás al día"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unread > 0 && (
            <button
              className="text-xs font-semibold text-pink-300 transition-colors duration-150 hover:text-pink-200"
              onClick={readAll}
            >
              Marcar leídas
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[.06] hover:text-zinc-300"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>
      <div className="h-px shrink-0 bg-white/[.07]" />
      {items.length === 0 ? (
        <div className="grid place-items-center gap-3 px-6 py-14 text-center">
          <EmptyState
            title="No hay notificaciones"
            description="Te avisaremos cuando haya movimientos nuevos."
          />
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto overscroll-contain min-h-0 admin-custom-scroll">
          {items.map((item, index) => {
            const unreadItem = !item.readAt;
            return (
              <li key={item.id} className={index > 0 ? "border-t border-white/[.04]" : ""}>
                <Link
                  href={adminHrefFromPathname(pathname, item.link || "/admin") as never}
                  onClick={close}
                  className={`group flex gap-3.5 px-5 py-4 transition-colors duration-150 hover:bg-white/[.04] ${
                    unreadItem ? "bg-white/[.02]" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <span className="relative mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[.06] text-[10px] font-black text-zinc-400">
                    {typeGlyph(item.type)}
                    {unreadItem && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-pink-500"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <strong className="min-w-0 truncate text-sm font-semibold text-white">
                        {item.title}
                      </strong>
                      <time className="shrink-0 text-[11px] text-zinc-500">
                        {relativeTime(item.createdAt)}
                      </time>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-zinc-400">
                      {item.message}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  /** @summary Botón de campana compartido entre todas las variantes. */
  const bellButton = (
    <button
      ref={buttonRef}
      className="relative grid h-11 w-11 place-items-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-white/[.06] hover:text-zinc-100 lg:h-9 lg:w-9"
      onClick={() => setOpen((v) => !v)}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Notificaciones"
      title="Notificaciones"
    >
      <BellIcon />
      {unread > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-pink-500 px-1 text-[9px] font-bold leading-none text-white"
          aria-label={`${unread} sin leer`}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );

  if (!compact) {
    // Variante legada de sidebar (en desuso tras el rediseño de la barra superior).
    return (
      <div className="relative border-b border-white/10 p-3">
        <button
          className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left text-sm font-bold hover:bg-white/10"
          onClick={() => setOpen((value) => !value)}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>Centro de actividad</span>
          {unread > 0 && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-pink-500 px-1 text-xs">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-[2px] modal-backdrop-in"
                aria-hidden="true"
              />
              <div
                ref={panelRef}
                className="fixed z-[310] flex max-h-[min(calc(100vh-2rem),80vh)] w-[min(480px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-950 shadow-2xl shadow-black/50 modal-panel-in
                left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                sm:left-auto sm:right-6 sm:translate-x-0 sm:translate-y-0 sm:top-[4.5rem]"
                role="dialog"
                aria-modal="true"
                aria-label="Notificaciones"
              >
                {notificationPanelContent}
              </div>
            </>,
            document.body,
          )}
      </div>
    );
  }

  if (sidebarMode) {
    return (
      <>
        {bellButton}
        {open &&
          typeof document !== "undefined" &&
          createPortal(
            <>
              <div
                className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-[2px] modal-backdrop-in"
                aria-hidden="true"
              />
              <div
                ref={panelRef}
                className="fixed z-[310] flex max-h-[min(calc(100vh-2rem),80vh)] w-[min(480px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-950 shadow-2xl shadow-black/50 modal-panel-in
                left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                role="dialog"
                aria-modal="true"
                aria-label="Notificaciones"
              >
                {notificationPanelContent}
              </div>
            </>,
            document.body,
          )}
      </>
    );
  }

  return (
    <>
      {bellButton}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-[2px] modal-backdrop-in"
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              className="fixed z-[310] flex max-h-[min(calc(100vh-2rem),80vh)] w-[min(480px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/[.08] bg-zinc-950 shadow-2xl shadow-black/50 modal-panel-in
              right-4 top-[4.5rem]
              max-sm:left-4 max-sm:right-4 max-sm:top-1/2 max-sm:-translate-y-1/2 max-sm:translate-x-0"
              role="dialog"
              aria-modal="true"
              aria-label="Notificaciones"
            >
              {notificationPanelContent}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
