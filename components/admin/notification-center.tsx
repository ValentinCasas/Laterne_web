"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
 * @summary Carga, presenta y marca avisos del panel sin interrumpir la tarea actual.
 * `compact` lo adapta a la barra superior (campana + panel flotante amplio).
 * `sidebarMode` posiciona el dropdown hacia la derecha (para rail lateral de 68px).
 */
export function NotificationCenter({ compact = false, sidebarMode = false }: { compact?: boolean; sidebarMode?: boolean }) {
  const pathname = usePathname();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    /**
     * @summary Recarga las notificaciones y conserva el estado de la interfaz.
     */
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

  useEffect(() => {
    if (!open) return;
    /** @summary Cierra el panel de avisos al interactuar fuera de él o con Escape. */
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

  if (!compact) {
    // Variante legada de sidebar (en desuso tras el rediseño de la barra superior).
    return (
      <div className="relative border-b border-white/10 p-3" ref={containerRef}>
        <button
          className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left text-sm font-bold hover:bg-white/10"
          onClick={() => setOpen((value) => !value)}
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
        >
          <span>Centro de actividad</span>
          {unread > 0 && (
            <span className="grid h-6 min-w-6 place-items-center rounded-full bg-pink-500 px-1 text-xs">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute left-3 right-3 top-[calc(100%-.25rem)] z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl">
            <header className="flex items-center justify-between p-3">
              <strong>Notificaciones</strong>
              {unread > 0 && (
                <button className="text-xs text-pink-300" onClick={readAll}>
                  Marcar leídas
                </button>
              )}
            </header>
            {items.map((item) => (
              <Link
                className={`block rounded-xl p-3 hover:bg-white/5 ${item.readAt ? "opacity-60" : "bg-pink-500/5"}`}
                href={adminHrefFromPathname(pathname, item.link || "/admin") as never}
                key={item.id}
                onClick={() => setOpen(false)}
              >
                <strong className="text-sm">{item.title}</strong>
                <p className="mt-1 text-xs text-zinc-400">{item.message}</p>
                <time className="mt-1 block text-[10px] text-zinc-600">{relativeTime(item.createdAt)}</time>
              </Link>
            ))}
            {!items.length && <p className="p-6 text-center text-sm text-zinc-500">No hay notificaciones.</p>}
          </div>
        )}
      </div>
    );
  }

  const notificationPanel = (
    <>
      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h2 className="text-sm font-bold text-white">Notificaciones</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            {unread > 0 ? `${unread} sin leer` : "Estás al día"}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={() => setOpen(false)}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[.06] hover:text-zinc-300"
            aria-label="Cerrar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>
      <div className="h-px shrink-0 bg-white/[.07]" />
      {items.length === 0 ? (
        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
          <EmptyState
            title="No hay notificaciones"
            description="Te avisaremos cuando haya movimientos nuevos."
          />
        </div>
      ) : (
        <ul className="max-h-[26rem] flex-1 overflow-y-auto overscroll-contain">
          {items.map((item) => {
            const unreadItem = !item.readAt;
            return (
              <li key={item.id}>
                <Link
                  href={adminHrefFromPathname(pathname, item.link || "/admin") as never}
                  onClick={() => setOpen(false)}
                  className={`flex gap-3.5 px-5 py-4 transition-colors duration-150 hover:bg-white/[.04] ${
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
                      <strong className="truncate text-sm font-semibold text-white">{item.title}</strong>
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

  /** @summary En sidebar mode, las notificaciones se muestran como modal centrado. */
  if (sidebarMode) {
    return (
      <div className="relative" ref={containerRef}>
        <button
          className="relative grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-white/[.06] hover:text-zinc-100"
          onClick={() => setOpen((value) => !value)}
          type="button"
          aria-haspopup="true"
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
        {open && (
          <>
            <div
              className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-0 z-[310] flex items-center justify-center p-4" role="dialog" aria-label="Notificaciones">
              <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/40">
                {notificationPanel}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        className="relative grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition-colors duration-150 hover:bg-white/[.06] hover:text-zinc-100"
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-haspopup="true"
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
      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 flex max-h-[min(calc(100vh-6.5rem),34rem)] w-[29rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-xl shadow-black/25 backdrop-blur-xl">
          {notificationPanel}
        </div>
      )}
    </div>
  );
}
