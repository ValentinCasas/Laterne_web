"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type TrackOptions = {
  entityType?: "product" | "category" | "promotion" | "reservation" | "order" | "page";
  entityId?: number;
  metadata?: Record<string, string | number | boolean>;
};

/** @summary Recupera o crea el identificador anónimo que agrupa una sesión de navegación. */
function analyticsSession() {
  const key = "laterne_analytics_session";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(key, created);
  return created;
}

/** @summary Envía un evento analítico no bloqueante sin incluir datos personales del visitante. */
export function trackEvent(eventType: string, options: TrackOptions = {}) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem("laterne_analytics_consent") !== "accepted") return;
  const privacyControl = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  if (privacyControl) return;
  const payload = JSON.stringify({
    eventType,
    sessionId: analyticsSession(),
    path: window.location.pathname,
    entityType: options.entityType,
    entityId: options.entityId,
    metadata: {
      device: window.matchMedia("(max-width: 640px)").matches ? "mobile" : "desktop",
      ...options.metadata,
    },
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
    return;
  }
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  });
}

/** @summary Registra una única vista anónima cada vez que cambia la ruta pública. */
export function AnalyticsTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    trackEvent(pathname === "/carta" ? "menu.open" : "page.view", { entityType: "page" });
    const accepted = () =>
      trackEvent(pathname === "/carta" ? "menu.open" : "page.view", { entityType: "page" });
    window.addEventListener("laterne-consent", accepted, { once: true });
    return () => window.removeEventListener("laterne-consent", accepted);
  }, [pathname]);
  return null;
}
