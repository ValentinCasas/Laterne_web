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

/** @summary Carga medidores externos válidos únicamente después del consentimiento explícito. */
function loadExternalAnalytics(analyticsId?: string | null, metaPixelId?: string | null) {
  if (localStorage.getItem("laterne_analytics_consent") !== "accepted") return;
  const privacyControl = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
  if (privacyControl) return;
  if (
    analyticsId &&
    /^G-[A-Z0-9]{4,20}$/i.test(analyticsId) &&
    !document.querySelector("[data-laterne-ga]")
  ) {
    const script = document.createElement("script");
    script.async = true;
    script.dataset.laterneGa = "true";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`;
    document.head.appendChild(script);
    const scope = window as typeof window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
    scope.dataLayer = scope.dataLayer ?? [];
    scope.gtag = (...args: unknown[]) => scope.dataLayer?.push(args);
    scope.gtag("js", new Date());
    scope.gtag("config", analyticsId, { anonymize_ip: true });
  }
  if (metaPixelId && /^\d{5,30}$/.test(metaPixelId) && !document.querySelector("[data-laterne-meta]")) {
    type PixelFunction = ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[][];
      loaded?: boolean;
      version?: string;
    };
    const scope = window as typeof window & { fbq?: PixelFunction };

    /**
     * @summary Envía comandos al píxel de Meta o los conserva en espera hasta que termine de cargar.
     */
    const pixel: PixelFunction = (...args: unknown[]) => {
      if (pixel.callMethod) pixel.callMethod(...args);
      else pixel.queue?.push(args);
    };
    pixel.queue = [];
    pixel.loaded = true;
    pixel.version = "2.0";
    scope.fbq = scope.fbq ?? pixel;
    const script = document.createElement("script");
    script.async = true;
    script.dataset.laterneMeta = "true";
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
    scope.fbq("init", metaPixelId);
    scope.fbq("track", "PageView");
  }
}

/** @summary Registra vistas propias y activa proveedores externos solo con consentimiento vigente. */
export function AnalyticsTracker({
  analyticsId,
  metaPixelId,
}: {
  analyticsId?: string | null;
  metaPixelId?: string | null;
}) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    trackEvent(pathname === "/carta" ? "menu.open" : "page.view", { entityType: "page" });
    loadExternalAnalytics(analyticsId, metaPixelId);
    /** @summary Activa las mediciones permitidas cuando el visitante otorga su consentimiento. */
    const accepted = () => {
      loadExternalAnalytics(analyticsId, metaPixelId);
      trackEvent(pathname === "/carta" ? "menu.open" : "page.view", { entityType: "page" });
    };
    window.addEventListener("laterne-consent", accepted, { once: true });
    return () => window.removeEventListener("laterne-consent", accepted);
  }, [analyticsId, metaPixelId, pathname]);
  return null;
}
