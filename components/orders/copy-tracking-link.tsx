"use client";

import { useEffect, useState } from "react";
import { copyBrowserText } from "@/lib/browser-compat";

/** @summary Copia un enlace seguro de seguimiento y confirma la acción sin exigir selección manual. */
export function CopyTrackingLink({ href, compact = false }: { href: string; compact?: boolean }) {
  const [absoluteHref, setAbsoluteHref] = useState(href);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setAbsoluteHref(new URL(href, window.location.origin).toString()),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [href]);

  /**
   * @summary Copia el valor solicitado desde la copia del enlace de seguimiento.
   */
  async function copy() {
    const success = await copyBrowserText(absoluteHref);
    setCopied(success);
    if (success) window.setTimeout(() => setCopied(false), 2_500);
  }

  if (compact) {
    return (
      <button className="btn btn-secondary" onClick={() => void copy()} type="button">
        {copied ? "✓ Enlace copiado" : "▣ Copiar link de seguimiento"}
      </button>
    );
  }

  return (
    <section className="border-y border-white/10 bg-white/[.03] p-5 sm:p-8">
      <p className="text-xs font-black uppercase tracking-widest text-pink-300">Seguimiento de tu pedido</p>
      <p className="mt-3 break-all rounded-xl bg-black/30 p-3 text-sm text-zinc-300">{absoluteHref}</p>
      <button className="btn mt-3 min-h-11" onClick={() => void copy()} type="button">
        {copied ? "✓ Enlace copiado" : "▣ Copiar enlace"}
      </button>
    </section>
  );
}
