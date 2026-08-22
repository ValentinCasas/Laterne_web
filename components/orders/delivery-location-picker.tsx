"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";

export type ConfirmedDeliveryLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type BranchLocation = {
  name: string;
  latitude?: unknown;
  longitude?: unknown;
};

function validCoordinate(value: unknown, limit: number) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
}

/** @summary Permite al cliente confirmar un destino distinto haciendo clic o arrastrando un marcador. */
export function DeliveryLocationPicker({
  branch,
  value,
  onChange,
}: {
  branch?: BranchLocation | null;
  value: ConfirmedDeliveryLocation | null;
  onChange: (location: ConfirmedDeliveryLocation) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const [failed, setFailed] = useState(false);
  const branchLatitude = validCoordinate(branch?.latitude, 90);
  const branchLongitude = validCoordinate(branch?.longitude, 180);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!container.current || map.current) return;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");
    const initialLatitude = value?.latitude ?? branchLatitude ?? -34.6037;
    const initialLongitude = value?.longitude ?? branchLongitude ?? -58.3816;

    try {
      const instance = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [initialLongitude, initialLatitude],
        zoom: value || branchLatitude !== null ? 14 : 4,
        cooperativeGestures: true,
      });
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      instance.on("error", () => {
        if (!instance.isStyleLoaded()) startTransition(() => setFailed(true));
      });

      /** @summary Confirma el punto elegido y crea el marcador solo después de una acción explícita. */
      function choose(latitude: number, longitude: number) {
        if (!marker.current) {
          const nextMarker = new maplibregl.Marker({ color: "#ec4899", draggable: true })
            .setLngLat([longitude, latitude])
            .addTo(instance);
          nextMarker.on("dragend", () => {
            const position = nextMarker.getLngLat();
            onChangeRef.current({
              latitude: Number(position.lat.toFixed(7)),
              longitude: Number(position.lng.toFixed(7)),
            });
          });
          marker.current = nextMarker;
        } else {
          marker.current.setLngLat([longitude, latitude]);
        }
        onChangeRef.current({
          latitude: Number(latitude.toFixed(7)),
          longitude: Number(longitude.toFixed(7)),
        });
      }

      instance.on("click", (event) => choose(event.lngLat.lat, event.lngLat.lng));
      if (value) choose(value.latitude, value.longitude);
      map.current = instance;
    } catch {
      startTransition(() => setFailed(true));
    }

    return () => {
      marker.current = null;
      try {
        map.current?.remove();
      } catch {
        /* ya removido */
      }
      map.current = null;
    };
    // El mapa conserva su instancia; cambios posteriores se sincronizan abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!value || !map.current) return;
    marker.current?.setLngLat([value.longitude, value.latitude]);
    map.current.easeTo({ center: [value.longitude, value.latitude], duration: 350 });
  }, [value]);

  if (failed) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl border border-white/10 bg-zinc-950 p-6 text-center text-sm text-zinc-400">
        No pudimos cargar el mapa. Probá usar tu ubicación actual o intentá nuevamente.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
      <div ref={container} className="h-72 w-full sm:h-80" aria-label="Elegir punto de entrega en el mapa" />
      <div className="border-t border-white/10 px-4 py-3 text-xs">
        {value ? (
          <p className="font-bold text-emerald-300">Punto confirmado. Podés tocar otro lugar o arrastrar el marcador.</p>
        ) : (
          <p className="text-zinc-400">Tocá el lugar exacto donde querés recibir el pedido.</p>
        )}
      </div>
    </div>
  );
}
