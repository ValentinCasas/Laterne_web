"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

const links = [
  ["/carta", "Carta"],
  ["/#eventos", "Eventos"],
  ["/#horarios", "Horarios"],
  ["/promociones", "Promociones"],
  ["/reservas", "Reservas"],
  ["/fidelidad", "Puntos"],
  ["/ayuda", "Ayuda"],
  ["/para-negocios", "Para negocios"],
  ["/clientes", "Clientes"],
  ["/planes", "Planes"],
  ["/admin", "Administración"],
] as const;

/** @summary Renderiza la navegación principal adaptable a escritorio y dispositivos móviles. */
export function SiteHeader({
  brandName = "Laterne",
  logoUrl,
}: {
  brandName?: string;
  logoUrl?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur">
      <nav className="shell relative flex h-16 items-center justify-between" aria-label="Principal">
        <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-tight text-pink-500">
          {logoUrl && (
            <Image src={logoUrl} alt="" width={40} height={40} className="h-9 w-auto object-contain" />
          )}
          <span>
            {brandName}
            <span className="text-white">&.</span>
          </span>
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
          className={`${open ? "flex" : "hidden"} absolute inset-x-0 top-16 max-h-[calc(100vh-4rem)] flex-col gap-1 overflow-y-auto rounded-b-2xl border border-t-0 border-white/10 bg-black p-3 shadow-xl sm:static sm:flex sm:max-h-none sm:flex-row sm:items-center sm:gap-5 sm:overflow-visible sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
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
