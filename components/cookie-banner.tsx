"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { readBrowserText, writeBrowserText } from "@/lib/browser-compat";
import { parseCanonicalPath, publicHrefForContext } from "@/lib/routes";

/** @summary Solicita una preferencia explícita antes de habilitar medición anónima no esencial. */
export function CookieBanner() {
  const pathname = usePathname();
  const route = parseCanonicalPath(pathname);
  const legalHref = route.tenantSlug
    ? publicHrefForContext(route.tenantSlug, "/legal", route.branchSlug)
    : "/legal";
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(!readBrowserText("laterne_analytics_consent")), 0);
    return () => window.clearTimeout(timer);
  }, []);

  /** @summary Guarda la decisión local de analítica y oculta el aviso. */
  function choose(value: "accepted" | "denied") {
    writeBrowserText("laterne_analytics_consent", value);
    setVisible(false);
    if (value === "accepted") window.dispatchEvent(new Event("laterne-consent"));
  }

  if (!visible) return null;
  return (
    <aside
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 right-4 z-[130] mx-auto max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-white/15 bg-zinc-950 p-4 shadow-2xl sm:p-5"
      aria-label="Preferencias de cookies"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <strong>Tu privacidad importa</strong>
          <p className="mt-1 text-sm text-zinc-400">
            Usamos almacenamiento esencial para carrito y sesión. La medición anónima es opcional.
          </p>
          <Link className="mt-1 inline-block text-xs text-pink-300 underline" href={legalHref}>
            Ver políticas
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button className="btn btn-secondary" onClick={() => choose("denied")}>
            Solo esencial
          </button>
          <button className="btn" onClick={() => choose("accepted")}>
            Aceptar analítica
          </button>
        </div>
      </div>
    </aside>
  );
}
