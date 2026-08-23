"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { parseCanonicalPath } from "@/lib/routes";

/** @summary Registra el modo sin conexión y avisa cuando existe una versión nueva lista. */
export function PwaRegister() {
  const pathname = usePathname();
  const route = parseCanonicalPath(pathname);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let active = true;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((result) => {
      if (!active) return;
      if (result.waiting) setRegistration(result);
      result.addEventListener("updatefound", () => {
        const worker = result.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setRegistration(result);
        });
      });
    });
    return () => {
      active = false;
    };
  }, []);

  /** @summary Activa la actualización instalada y recarga el sitio con sus nuevos recursos. */
  function update() {
    registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    window.location.reload();
  }

  if (!registration) return null;
  const mobileBottom =
    route.surface === "tenant-driver"
      ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
      : route.surface === "tenant-public" && ["/carta", "/pedido"].includes(route.logicalPath)
        ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]"
        : "bottom-[max(1rem,env(safe-area-inset-bottom))]";
  return (
    <div className={`fixed left-4 right-4 z-[140] flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-500/30 bg-zinc-950 p-4 shadow-2xl sm:bottom-4 sm:left-auto sm:max-w-md ${mobileBottom}`}>
      <p className="text-sm font-bold">Hay una versión nueva disponible.</p>
      <button className="btn" onClick={update}>
        Actualizar
      </button>
    </div>
  );
}
