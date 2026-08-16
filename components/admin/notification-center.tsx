"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { scopedFetch } from "@/lib/client-routing";
import { adminHrefFromPathname } from "@/lib/routes";

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** @summary Ícono de campana monocromo para la variante compacta de la barra superior. */
function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @summary Carga, presenta y marca avisos del panel sin interrumpir la tarea actual.
 * `compact` lo adapta a la barra superior (campana con menú alineado a la derecha).
 */
export function NotificationCenter({ compact = false }: { compact?: boolean }) {
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
    /**
     * @summary Cierra el panel de avisos al interactuar fuera de él.
     */
    function handlePointer(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointer);
    return () => document.removeEventListener("pointerdown", handlePointer);
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

  return (
    <div className={compact ? "relative" : "relative border-b border-white/10 p-3"} ref={containerRef}>
      <button
        className={
          compact
            ? "relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-300 hover:border-white/25"
            : "flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left text-sm font-bold hover:bg-white/10"
        }
        onClick={() => setOpen((value) => !value)}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={compact ? "Centro de actividad" : undefined}
      >
        {compact ? <BellIcon /> : <span>Centro de actividad</span>}
        {unread > 0 && (
          <span
            className={
              compact
                ? "absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-pink-500 px-1 text-[10px] font-black text-white"
                : "grid h-6 min-w-6 place-items-center rounded-full bg-pink-500 px-1 text-xs"
            }
          >
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className={
            compact
              ? "absolute right-0 top-full z-50 mt-2 max-h-[min(60vh,28rem)] w-96 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl"
              : "absolute left-3 right-3 top-[calc(100%-.25rem)] z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl lg:left-full lg:right-auto lg:top-0 lg:ml-3 lg:w-96"
          }
        >
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
              <time className="mt-1 block text-[10px] text-zinc-600">
                {new Date(item.createdAt).toLocaleString("es-AR")}
              </time>
            </Link>
          ))}
          {!items.length && <p className="p-6 text-center text-sm text-zinc-500">No hay notificaciones.</p>}
        </div>
      )}
    </div>
  );
}
