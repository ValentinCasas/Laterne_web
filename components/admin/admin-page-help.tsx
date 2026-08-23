"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getAdminHelp } from "@/lib/admin-help";
import { parseCanonicalPath, publicHrefForContext } from "@/lib/routes";

type HelpPosition = { top: number; left: number; mobile: boolean };

/** @summary Muestra ayuda contextual accesible sin desbordar ni quedar recortada por el layout. */
export function AdminPageHelp({ section }: { section: string }) {
  const pathname = usePathname();
  const route = parseCanonicalPath(pathname);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<HelpPosition>({ top: 0, left: 0, mobile: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const entry = getAdminHelp(section);

  useLayoutEffect(() => {
    if (!open) return;

    /** @summary Ubica el panel dentro del viewport y cambia a sheet inferior en móvil. */
    function placePanel() {
      const anchor = buttonRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const mobile = window.innerWidth < 640;
      if (mobile) {
        setPosition({ top: 0, left: 0, mobile: true });
        return;
      }
      const panelWidth = Math.min(352, window.innerWidth - 24);
      const panelHeight = panelRef.current?.offsetHeight ?? 420;
      const left = Math.min(Math.max(12, anchor.left), window.innerWidth - panelWidth - 12);
      const fitsBelow = anchor.bottom + 8 + panelHeight <= window.innerHeight - 12;
      const top = fitsBelow ? anchor.bottom + 8 : Math.max(12, anchor.top - panelHeight - 8);
      setPosition({ top, left, mobile: false });
    }

    placePanel();
    window.addEventListener("resize", placePanel);
    window.addEventListener("scroll", placePanel, true);
    return () => {
      window.removeEventListener("resize", placePanel);
      window.removeEventListener("scroll", placePanel, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    /** @summary Cierra la ayuda con Escape o al interactuar fuera del botón y del panel. */
    function dismiss(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    }

    document.addEventListener("keydown", dismiss);
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [open]);

  if (!entry) return null;

  const panel = open ? (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[139] bg-black/60 backdrop-blur-[2px] sm:hidden"
        onClick={() => setOpen(false)}
        aria-label="Cerrar ayuda"
      />
      <div
        className={`fixed z-[140] max-h-[min(78dvh,38rem)] overflow-y-auto border border-[var(--admin-border-strong)] bg-[var(--admin-surface-overlay)] p-5 text-left shadow-2xl shadow-black/50 outline-none ${
          position.mobile
            ? "bottom-0 left-0 right-0 rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            : "w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl"
        }`}
        style={position.mobile ? undefined : { top: position.top, left: position.left }}
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={position.mobile ? "true" : "false"}
        aria-label={`Ayuda: ${entry.title}`}
      >
        <div className="flex items-start justify-between gap-4">
          <p className="text-xs font-black uppercase tracking-[.2em] text-[var(--admin-primary)]">¿Para qué sirve?</p>
          <button
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/5 text-sm text-zinc-400 transition hover:bg-white/10 hover:text-white sm:h-8 sm:w-8"
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar ayuda"
          >
            ×
          </button>
        </div>
        <h2 className="mt-2 text-lg font-black text-[var(--admin-text)]">{entry.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--admin-muted)]">{entry.intro}</p>
        <ul className="mt-4 space-y-2">
          {entry.points.map((point) => (
            <li className="flex gap-2 text-sm leading-relaxed text-zinc-300" key={point}>
              <span className="mt-1 shrink-0 text-[var(--admin-primary)]">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        {entry.warning && (
          <p className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">
            <strong className="block text-xs font-black uppercase tracking-wider text-amber-300">Importante</strong>
            {entry.warning}
          </p>
        )}
        {entry.guideSlug && (
          <Link
            className="mt-4 inline-block text-sm font-bold text-[var(--admin-primary)] transition hover:text-white"
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
    </>
  ) : null;

  return (
    <span className="inline-block align-middle">
      <button
        ref={buttonRef}
        className="grid h-11 w-11 place-items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-sm font-black text-[var(--admin-muted)] transition hover:border-[var(--admin-border-strong)] hover:text-white sm:h-8 sm:w-8"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Ayuda sobre esta sección: ${entry.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        ?
      </button>
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </span>
  );
}
