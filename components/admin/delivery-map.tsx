"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { avatarUrl } from "@/components/admin/profile-menu";
import { gpsFreshness } from "@/lib/delivery-tracking";

export type DeliveryMapPosition = {
  id: number;
  branchId?: number | null;
  deliveryId?: number | null;
  driverProfileId?: number | null;
  latitude: string | number;
  longitude: string | number;
  accuracy?: string | number | null;
  recordedAt: string | Date;
  driverProfile?: {
    id: number;
    name: string;
    status?: string | null;
    user?: { imageUrl?: string | null } | null;
  } | null;
};

type DeliveryDestination = {
  id: number;
  number: string;
  customerName: string;
  status?: string;
  latitude?: string | null;
  longitude?: string | null;
  driverProfile?: { id: number; name: string } | null;
};

type MapBranch = {
  id: number;
  name: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
};

type AnimatedMarker = {
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
  latitude: number;
  longitude: number;
  animationFrame?: number;
};

function validCoordinate(value: string | number | null | undefined, kind: "latitude" | "longitude") {
  const parsed = Number(value);
  const limit = kind === "latitude" ? 90 : 180;
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "?"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toLocaleUpperCase("es");
}

/** @summary Crea un avatar circular cuyo aro expresa frescura GPS, nunca mera disponibilidad laboral. */
function createDriverMarker(name: string, imageUrl?: string | null) {
  const element = document.createElement("button");
  element.type = "button";
  element.setAttribute("aria-label", `Abrir seguimiento de ${name}`);
  Object.assign(element.style, {
    width: "44px",
    height: "44px",
    padding: "3px",
    borderRadius: "999px",
    border: "3px solid #34d399",
    background: "#18181b",
    color: "#fff",
    fontSize: "11px",
    fontWeight: "800",
    boxShadow: "0 10px 28px rgba(0,0,0,.48)",
    overflow: "visible",
    cursor: "pointer",
    transition: "border-color 180ms ease, filter 180ms ease",
  });
  const content = document.createElement("span");
  Object.assign(content.style, {
    display: "grid",
    width: "100%",
    height: "100%",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: "999px",
    background: "#27272a",
  });
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    Object.assign(image.style, { width: "100%", height: "100%", objectFit: "cover" });
    image.addEventListener("error", () => content.replaceChildren(document.createTextNode(initials(name))));
    content.append(image);
  } else {
    content.textContent = initials(name);
  }
  const pulse = document.createElement("span");
  pulse.dataset.freshnessDot = "true";
  Object.assign(pulse.style, {
    position: "absolute",
    right: "-1px",
    bottom: "1px",
    width: "11px",
    height: "11px",
    borderRadius: "999px",
    border: "2px solid #18181b",
    background: "#34d399",
  });
  element.append(content, pulse);
  return element;
}

/** @summary Actualiza la señal visual de frescura del avatar sin confundir una posición vieja con presencia online. */
function updateDriverMarkerFreshness(element: HTMLButtonElement, state: "live" | "recent" | "stale", label: string) {
  const color = state === "live" ? "#34d399" : state === "recent" ? "#fbbf24" : "#71717a";
  element.style.borderColor = color;
  element.style.filter = state === "stale" ? "grayscale(.45)" : "none";
  element.title = label;
  const dot = element.querySelector<HTMLElement>("[data-freshness-dot]");
  if (dot) dot.style.background = color;
}

/** @summary Interpola una posición existente para evitar saltos al recibir una lectura nueva. */
function animateMarker(entry: AnimatedMarker, latitude: number, longitude: number) {
  if (entry.animationFrame) window.cancelAnimationFrame(entry.animationFrame);
  const fromLatitude = entry.latitude;
  const fromLongitude = entry.longitude;
  const startedAt = performance.now();
  const duration = 900;
  const frame = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    const currentLatitude = fromLatitude + (latitude - fromLatitude) * eased;
    const currentLongitude = fromLongitude + (longitude - fromLongitude) * eased;
    entry.marker.setLngLat([currentLongitude, currentLatitude]);
    entry.latitude = currentLatitude;
    entry.longitude = currentLongitude;
    if (progress < 1) entry.animationFrame = window.requestAnimationFrame(frame);
    else entry.animationFrame = undefined;
  };
  entry.animationFrame = window.requestAnimationFrame(frame);
}

function createBranchMarker() {
  const element = document.createElement("div");
  element.setAttribute("aria-label", "Ubicación del local");
  Object.assign(element.style, {
    width: "30px",
    height: "30px",
    borderRadius: "10px",
    border: "2px solid #f9a8d4",
    background: "#db2777",
    boxShadow: "0 8px 22px rgba(219,39,119,.35)",
    transform: "rotate(45deg)",
  });
  const center = document.createElement("span");
  Object.assign(center.style, {
    display: "block",
    width: "8px",
    height: "8px",
    margin: "9px",
    borderRadius: "3px",
    background: "white",
  });
  element.append(center);
  return element;
}

/** @summary Mapa operativo persistente con sucursal, destinos y repartidores del alcance autorizado. */
export function DeliveryMap({
  branch,
  positions,
  deliveries,
  selectedDeliveryId,
  onSelectDelivery,
  onSelectDriver,
}: {
  branch: MapBranch | null;
  positions: DeliveryMapPosition[];
  deliveries: DeliveryDestination[];
  selectedDeliveryId?: number | null;
  onSelectDelivery?: (deliveryId: number) => void;
  onSelectDriver?: (driverProfileId: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const branchMarker = useRef<maplibregl.Marker | null>(null);
  const driverMarkers = useRef(new Map<number, AnimatedMarker>());
  const deliveryMarkers = useRef(new Map<number, maplibregl.Marker>());
  const hasFitted = useRef(false);
  const onSelectDeliveryRef = useRef(onSelectDelivery);
  const onSelectDriverRef = useRef(onSelectDriver);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    onSelectDeliveryRef.current = onSelectDelivery;
  }, [onSelectDelivery]);
  useEffect(() => {
    onSelectDriverRef.current = onSelectDriver;
  }, [onSelectDriver]);

  const validBranch = useMemo(() => {
    const latitude = validCoordinate(branch?.latitude, "latitude");
    const longitude = validCoordinate(branch?.longitude, "longitude");
    return branch && latitude !== null && longitude !== null ? { ...branch, latitude, longitude } : null;
  }, [branch]);
  const validPositions = useMemo(
    () =>
      positions.flatMap((position) => {
        const latitude = validCoordinate(position.latitude, "latitude");
        const longitude = validCoordinate(position.longitude, "longitude");
        return latitude === null || longitude === null ? [] : [{ ...position, latitude, longitude }];
      }),
    [positions],
  );
  const validDeliveries = useMemo(
    () =>
      deliveries.flatMap((delivery) => {
        const latitude = validCoordinate(delivery.latitude, "latitude");
        const longitude = validCoordinate(delivery.longitude, "longitude");
        return latitude === null || longitude === null ? [] : [{ ...delivery, latitude, longitude }];
      }),
    [deliveries],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!container.current || map.current) return;
    const driverMarkerStore = driverMarkers.current;
    const deliveryMarkerStore = deliveryMarkers.current;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    const initialCenter: [number, number] = validBranch
      ? [validBranch.longitude, validBranch.latitude]
      : validPositions[0]
        ? [validPositions[0].longitude, validPositions[0].latitude]
        : [0, 0];
    try {
      const instance = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: initialCenter,
        zoom: validBranch || validPositions[0] ? 13 : 1,
        cooperativeGestures: true,
      });
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.on("error", () => {
        if (!instance.isStyleLoaded()) startTransition(() => setFailed(true));
      });
      map.current = instance;
    } catch {
      startTransition(() => setFailed(true));
    }
    return () => {
      branchMarker.current?.remove();
      branchMarker.current = null;
      for (const entry of driverMarkerStore.values()) {
        if (entry.animationFrame) window.cancelAnimationFrame(entry.animationFrame);
        entry.marker.remove();
      }
      driverMarkerStore.clear();
      for (const marker of deliveryMarkerStore.values()) marker.remove();
      deliveryMarkerStore.clear();
      try {
        map.current?.remove();
      } catch {
        /* ya removido */
      }
      map.current = null;
    };
    // El centro inicial solo debe resolverse al construir la instancia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    branchMarker.current?.remove();
    branchMarker.current = null;
    if (!validBranch) return;
    const popup = new maplibregl.Popup({ offset: 22 }).setText(
      validBranch.address ? `${validBranch.name} · ${validBranch.address}` : validBranch.name,
    );
    branchMarker.current = new maplibregl.Marker({ element: createBranchMarker(), anchor: "bottom" })
      .setLngLat([validBranch.longitude, validBranch.latitude])
      .setPopup(popup)
      .addTo(instance);
    if (hasFitted.current) instance.easeTo({ center: [validBranch.longitude, validBranch.latitude], duration: 550 });
  }, [validBranch]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const activeIds = new Set<number>();
    for (const delivery of validDeliveries) {
      activeIds.add(delivery.id);
      deliveryMarkers.current.get(delivery.id)?.remove();
      const element = document.createElement("button");
      element.type = "button";
      element.setAttribute("aria-label", `Abrir entrega ${delivery.number}`);
      Object.assign(element.style, {
        width: delivery.id === selectedDeliveryId ? "22px" : "18px",
        height: delivery.id === selectedDeliveryId ? "22px" : "18px",
        borderRadius: "999px",
        border: "3px solid white",
        background: delivery.id === selectedDeliveryId ? "#ec4899" : "#64748b",
        boxShadow: "0 5px 16px rgba(0,0,0,.38)",
        cursor: "pointer",
      });
      element.addEventListener("click", () => onSelectDeliveryRef.current?.(delivery.id));
      const marker = new maplibregl.Marker({ element })
        .setLngLat([delivery.longitude, delivery.latitude])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText(`${delivery.number} · ${delivery.customerName}`))
        .addTo(instance);
      deliveryMarkers.current.set(delivery.id, marker);
    }
    for (const [id, marker] of deliveryMarkers.current) {
      if (!activeIds.has(id)) {
        marker.remove();
        deliveryMarkers.current.delete(id);
      }
    }
  }, [selectedDeliveryId, validDeliveries]);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const activeIds = new Set<number>();
    for (const position of validPositions) {
      const profile = position.driverProfile;
      if (!profile) continue;
      activeIds.add(profile.id);
      const freshness = gpsFreshness(position.recordedAt, now);
      const assignment = deliveries.find(
        (delivery) => delivery.driverProfile?.id === profile.id && !["DELIVERED", "FAILED", "CANCELLED"].includes(delivery.status ?? ""),
      );
      let entry = driverMarkers.current.get(profile.id);
      if (!entry) {
        const element = createDriverMarker(profile.name, avatarUrl(profile.user?.imageUrl ?? undefined));
        element.addEventListener("click", () => onSelectDriverRef.current?.(profile.id));
        const marker = new maplibregl.Marker({ element, anchor: "bottom" })
          .setLngLat([position.longitude, position.latitude])
          .addTo(instance);
        entry = { marker, element, latitude: position.latitude, longitude: position.longitude };
        driverMarkers.current.set(profile.id, entry);
      } else if (entry.latitude !== position.latitude || entry.longitude !== position.longitude) {
        animateMarker(entry, position.latitude, position.longitude);
      }
      updateDriverMarkerFreshness(entry.element, freshness.state, freshness.label);
      const detail = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = profile.name;
      const state = document.createElement("p");
      state.textContent = `${profile.status ?? "Sin estado"} · ${freshness.label}`;
      detail.append(title, state);
      if (assignment) {
        const assigned = document.createElement("p");
        assigned.textContent = `Entrega ${assignment.number} · ${assignment.customerName}`;
        detail.append(assigned);
      }
      entry.marker.setPopup(new maplibregl.Popup({ offset: 25 }).setDOMContent(detail));
    }
    for (const [id, entry] of driverMarkers.current) {
      if (!activeIds.has(id)) {
        if (entry.animationFrame) window.cancelAnimationFrame(entry.animationFrame);
        entry.marker.remove();
        driverMarkers.current.delete(id);
      }
    }
  }, [deliveries, now, validPositions]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || hasFitted.current) return;
    const bounds = new maplibregl.LngLatBounds();
    if (validBranch) bounds.extend([validBranch.longitude, validBranch.latitude]);
    for (const delivery of validDeliveries) bounds.extend([delivery.longitude, delivery.latitude]);
    for (const position of validPositions) bounds.extend([position.longitude, position.latitude]);
    if (!bounds.isEmpty()) instance.fitBounds(bounds, { padding: 58, maxZoom: 15, duration: 0 });
    hasFitted.current = true;
  }, [validBranch, validDeliveries, validPositions]);

  if (failed) {
    return (
      <div className="grid h-[38dvh] min-h-80 max-h-[520px] place-items-center bg-[var(--admin-surface)] px-6 text-center text-sm text-[var(--admin-muted)] md:h-[42dvh]">
        <div><p className="font-bold text-[var(--admin-text)]">Mapa temporalmente no disponible</p><p className="mt-1">La cola y las asignaciones siguen operativas.</p></div>
      </div>
    );
  }

  return (
    <div className="relative h-[38dvh] min-h-80 max-h-[520px] overflow-hidden bg-[var(--admin-surface)] md:h-[42dvh]">
      <div ref={container} className="h-full w-full" aria-label="Mapa de repartidores, sucursal y entregas" />
      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-400/25 bg-zinc-950/90 px-3.5 py-2 text-xs font-bold text-emerald-300 shadow-lg backdrop-blur">
          {validPositions.length} repartidores localizados
        </span>
        <span className="rounded-full border border-white/10 bg-zinc-950/90 px-3.5 py-2 text-xs font-bold text-zinc-200 shadow-lg backdrop-blur">
          {validDeliveries.length} destinos
        </span>
      </div>
      {validPositions.length === 0 && validBranch && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
          <p className="rounded-xl border border-white/10 bg-zinc-950/85 px-3 py-2 text-center text-xs font-semibold text-zinc-300 shadow-lg backdrop-blur">
            Todavía no hay repartidores compartiendo ubicación.
          </p>
        </div>
      )}
      {!validBranch && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
          <p className="rounded-xl border border-amber-400/20 bg-zinc-950/85 px-3 py-2 text-center text-xs font-semibold text-amber-200 shadow-lg backdrop-blur">
            Configurá latitud y longitud de la sucursal para centrar el mapa.
          </p>
        </div>
      )}
    </div>
  );
}
