"use client";

import { useEffect, useRef, useState, startTransition } from "react";
import * as maplibregl from "maplibre-gl";

/** @summary Renderiza un mapa interactivo centrado en la ubicación pública del negocio. */
export function BusinessMap({
  latitude,
  longitude,
  address,
}: {
  latitude: number;
  longitude: number;
  address: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const hasValidLocation = Number.isFinite(latitude) && Number.isFinite(longitude);

  useEffect(() => {
    if (!container.current || !hasValidLocation) {
      startTransition(() => setFailed(true));
      return;
    }

    // Next.js no puede inferir la URL del worker de MapLibre después de empaquetar.
    // Se sirve localmente para impedir que el mapa solicite por error la URL de la página.
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [longitude, latitude],
        zoom: 15.5,
        cooperativeGestures: true,
      });
    } catch {
      startTransition(() => setFailed(true));
      return;
    }

    map.on("error", (_event) => {
      if (!map.isStyleLoaded()) {
        try {
          map.remove();
        } catch {
          /* ya removido */
        }
        startTransition(() => setFailed(true));
      }
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    new maplibregl.Marker({ color: "#ec4899" })
      .setLngLat([longitude, latitude])
      .setPopup(new maplibregl.Popup({ offset: 28 }).setText(address || "Ubicación del negocio"))
      .addTo(map);

    return () => {
      try {
        map.remove();
      } catch {
        /* ya removido */
      }
    };
  }, [address, hasValidLocation, latitude, longitude]);

  if (failed || !hasValidLocation) {
    return (
      <div
        className="grid h-[520px] w-full place-items-center rounded-2xl border border-white/10 bg-zinc-900/60 p-6 text-center text-sm text-zinc-400"
        aria-label={`Ubicación de ${address || "del negocio"}`}
      >
        <div>
          <p className="font-bold text-zinc-200">Mapa no disponible</p>
          <p className="mt-1">{address || "Ubicación del negocio"}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={container}
      className="h-[520px] w-full"
      aria-label={`Mapa interactivo de ${address || "Ubicación del negocio"}`}
    />
  );
}
