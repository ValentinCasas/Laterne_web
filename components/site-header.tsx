"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  ["/carta", "Carta"],
  ["/#eventos", "Eventos"],
  ["/#horarios", "Horarios"],
  ["/admin", "Administración"],
] as const;

/** @summary Renderiza la navegación principal adaptable a escritorio y dispositivos móviles. */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur">
      <nav className="shell relative flex h-16 items-center justify-between" aria-label="Principal">
        <Link href="/" className="text-2xl font-black tracking-tight text-pink-500">
          Laterne<span className="text-white">&.</span>
        </Link>
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 sm:hidden"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="main-navigation"
          aria-label="Abrir navegación"
        >
          <span className="text-xl">{open ? "×" : "☰"}</span>
        </button>
        <div
          id="main-navigation"
          className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-16 flex-col gap-1 rounded-b-2xl border border-t-0 border-white/10 bg-black p-3 shadow-xl sm:static sm:flex sm:flex-row sm:items-center sm:gap-5 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
        >
          {links.map(([href, label]) => (
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-white/10 hover:text-pink-400 sm:p-0 sm:hover:bg-transparent"
              key={href}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
