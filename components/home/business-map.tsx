"use client";

import { useEffect, useRef } from "react";
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

  useEffect(() => {
    if (!container.current) return;

    // Next.js no puede inferir la URL del worker de MapLibre después de empaquetar.
    // Se sirve localmente para impedir que el mapa solicite por error la URL de la página.
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

    const map = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [longitude, latitude],
      zoom: 15.5,
      cooperativeGestures: true,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    new maplibregl.Marker({ color: "#ec4899" })
      .setLngLat([longitude, latitude])
      .setPopup(new maplibregl.Popup({ offset: 28 }).setText(address || "Ubicación del negocio"))
      .addTo(map);

    return () => map.remove();
  }, [address, latitude, longitude]);

  return (
    <div
      ref={container}
      className="h-[520px] w-full"
      aria-label={`Mapa interactivo de ${address || "Ubicación del negocio"}`}
    />
  );
}
