"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAdminHelp } from "@/lib/admin-help";
import { parseCanonicalPath, publicHrefForContext } from "@/lib/routes";

/** @summary Muestra ayuda contextual de una sección desde un ícono "?" accesible. */
export function AdminPageHelp({ section }: { section: string }) {
  const pathname = usePathname();
  const route = parseCanonicalPath(pathname);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const entry = getAdminHelp(section);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    /** @summary Cierra el panel con Escape o al hacer clic fuera del mismo. */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    /**
     * @summary Inicia el arrastre del panel de ayuda sin interferir con controles interactivos.
     */
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  if (!entry) return null;

  return (
    <span className="relative inline-block align-middle" ref={containerRef}>
      <button
        className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-sm font-black text-zinc-400 transition hover:border-white/25 hover:text-white"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Ayuda sobre esta sección: ${entry.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        ?
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-[min(88vw,22rem)] rounded-2xl border border-white/10 bg-zinc-950 p-5 text-left shadow-2xl shadow-black/50"
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-label={`Ayuda: ${entry.title}`}
        >
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-black uppercase tracking-[.2em] text-pink-300">¿Para qué sirve?</p>
            <button
              className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar ayuda"
            >
              ×
            </button>
          </div>
          <h2 className="mt-2 text-lg font-black">{entry.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{entry.intro}</p>
          <ul className="mt-4 space-y-2">
            {entry.points.map((point) => (
              <li className="flex gap-2 text-sm leading-relaxed text-zinc-300" key={point}>
                <span className="mt-1 shrink-0 text-pink-400">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          {entry.warning && (
            <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
              <strong className="block text-xs font-black uppercase tracking-wider text-amber-300">
                Importante
              </strong>
              {entry.warning}
            </p>
          )}
          {entry.guideSlug && (
            <Link
              className="mt-4 inline-block text-sm font-bold text-pink-300 hover:text-pink-200"
              href={
                route.tenantSlug
                  ? publicHrefForContext(route.tenantSlug, `/ayuda/${entry.guideSlug}`)
                  : `/ayuda/${entry.guideSlug}`
              }
              onClick={() => setOpen(false)}
            >
              Ver guía completa →
            </Link>
          )}
        </div>
      )}
    </span>
  );
}
