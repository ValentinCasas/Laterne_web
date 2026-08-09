"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

/** @summary Carga, presenta y marca avisos del panel sin interrumpir la tarea actual. */
export function NotificationCenter() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/notifications")
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          notifications: AdminNotification[];
          unread: number;
        }>;
      })
      .then((result) => {
        if (active && result) {
          setItems(result.notifications);
          setUnread(result.unread);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  /** @summary Marca los avisos pendientes como leídos y actualiza su apariencia local. */
  async function readAll() {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    setUnread(0);
  }

  return (
    <div className="relative border-b border-white/10 p-3">
      <button
        className="flex w-full items-center justify-between rounded-2xl bg-white/5 px-4 py-3 text-left text-sm font-bold hover:bg-white/10"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>Centro de actividad</span>
        {unread > 0 && (
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-pink-500 px-1 text-xs">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-3 right-3 top-[calc(100%-.25rem)] z-50 max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-2 shadow-2xl lg:left-full lg:right-auto lg:top-0 lg:ml-3 lg:w-96">
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
              href={(item.link || "/admin") as never}
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
