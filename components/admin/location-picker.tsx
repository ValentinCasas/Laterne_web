"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";

const defaultLocation = { latitude: -33.3017, longitude: -66.3378 };

/** @summary Permite seleccionar las coordenadas del negocio haciendo clic o moviendo el marcador. */
export function LocationPicker({
  initialLatitude,
  initialLongitude,
}: {
  initialLatitude: string;
  initialLongitude: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const startLocation = useMemo(() => {
    const parsedLatitude = initialLatitude.trim() ? Number(initialLatitude) : Number.NaN;
    const parsedLongitude = initialLongitude.trim() ? Number(initialLongitude) : Number.NaN;
    return {
      latitude: Number.isFinite(parsedLatitude) ? parsedLatitude : defaultLocation.latitude,
      longitude: Number.isFinite(parsedLongitude) ? parsedLongitude : defaultLocation.longitude,
    };
  }, [initialLatitude, initialLongitude]);
  const [latitude, setLatitude] = useState(startLocation.latitude);
  const [longitude, setLongitude] = useState(startLocation.longitude);

  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

    const instance = new maplibregl.Map({
      container: container.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [startLocation.longitude, startLocation.latitude],
      zoom: 14.5,
      cooperativeGestures: true,
    });
    const point = new maplibregl.Marker({ color: "#ec4899", draggable: true })
      .setLngLat([startLocation.longitude, startLocation.latitude])
      .addTo(instance);

    /** @summary Sincroniza los campos cuando el marcador se mueve dentro del mapa. */
    function syncMarker() {
      const position = point.getLngLat();
      setLatitude(Number(position.lat.toFixed(7)));
      setLongitude(Number(position.lng.toFixed(7)));
    }

    instance.addControl(new maplibregl.NavigationControl(), "top-right");
    instance.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");
    instance.on("click", (event) => {
      point.setLngLat(event.lngLat);
      syncMarker();
    });
    point.on("dragend", syncMarker);
    map.current = instance;
    marker.current = point;

    return () => {
      marker.current = null;
      map.current = null;
      instance.remove();
    };
  }, [startLocation]);

  /** @summary Actualiza manualmente una coordenada y reposiciona el mapa y su marcador. */
  function updateCoordinates(nextLatitude: number, nextLongitude: number) {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) return;
    marker.current?.setLngLat([nextLongitude, nextLatitude]);
    map.current?.easeTo({ center: [nextLongitude, nextLatitude], duration: 450 });
  }

  return (
    <fieldset className="min-w-0 md:col-span-2">
      <legend className="text-sm font-bold text-zinc-200">Ubicación en el mapa</legend>
      <p className="mt-1 text-sm text-zinc-500">
        Hacé clic sobre el mapa o arrastrá el marcador rosa hasta la entrada del local.
      </p>
      <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900">
        <div ref={container} className="h-96 w-full" aria-label="Selector de ubicación del negocio" />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">
          Latitud
          <input
            className="input mt-2"
            name="latitude"
            type="number"
            step="any"
            value={latitude}
            onChange={(event) => updateCoordinates(Number(event.target.value), longitude)}
          />
        </label>
        <label className="text-sm font-bold">
          Longitud
          <input
            className="input mt-2"
            name="longitude"
            type="number"
            step="any"
            value={longitude}
            onChange={(event) => updateCoordinates(latitude, Number(event.target.value))}
          />
        </label>
      </div>
    </fieldset>
  );
}
