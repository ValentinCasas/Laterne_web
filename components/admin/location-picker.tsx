"use client";

import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import * as maplibregl from "maplibre-gl";

const defaultLocation = { latitude: -33.3017, longitude: -66.3378 };

/** @summary Distancia aproximada entre dos puntos usando la fórmula de Haversine (en metros). */
function distanceMeters(
  longitudeA: number,
  latitudeA: number,
  longitudeB: number,
  latitudeB: number,
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371_000 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** @summary Convierte un radio en metros a píxeles para el nivel de zoom actual del mapa. */
function radiusPixels(map: maplibregl.Map, longitude: number, latitude: number, meters: number) {
  const center = map.project([longitude, latitude]);
  const eastPixel = map.unproject([center.x + 1, center.y]);
  const metersPerPixel = distanceMeters(
    longitude,
    latitude,
    eastPixel.lng,
    eastPixel.lat,
  );
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return 0;
  return meters / metersPerPixel;
}

/** @summary Permite seleccionar las coordenadas del negocio haciendo clic o moviendo el marcador. */
export function LocationPicker({
  initialLatitude,
  initialLongitude,
  radiusMeters,
}: {
  initialLatitude: string;
  initialLongitude: string;
  radiusMeters?: number | string | null;
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
  const parsedRadius = Number(radiusMeters);
  const hasRadius = Number.isFinite(parsedRadius) && parsedRadius > 0;
  const hasValidLocation =
    Number.isFinite(startLocation.latitude) && Number.isFinite(startLocation.longitude);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    if (!container.current || !hasValidLocation) return;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [startLocation.longitude, startLocation.latitude],
        zoom: 14.5,
        cooperativeGestures: true,
      });
    } catch {
      startTransition(() => setMapFailed(true));
      return;
    }

    /** @summary Si el proveedor de tiles no responde, degradamos a un fallback controlado. */
    instance.on("error", (event) => {
      // Antes de cargar el estilo, cualquier fallo (style/tile 4xx/5xx/red) es fatal.
      if (!instance.isStyleLoaded()) {
        try {
          instance.remove();
        } catch {
          /* ya removido */
        }
        startTransition(() => setMapFailed(true));
        return;
      }
      // Errores de tiles sueltos luego de cargar: se ignoran para no romper la vista.
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("Mapa: tile no disponible", (event.error as Error)?.message);
      }
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

    /** @summary Dibuja el círculo del área habilitada alrededor de la ubicación actual. */
    function drawRadius() {
      if (!hasRadius) return;
      const position = point.getLngLat();
      if (!instance.getSource("geofence-radius")) {
        instance.addSource("geofence-radius", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [position.lng, position.lat] } },
        });
        instance.addLayer({
          id: "geofence-radius-fill",
          type: "circle",
          source: "geofence-radius",
          paint: {
            "circle-radius": 0,
            "circle-color": "rgba(59, 130, 246, 0.18)",
            "circle-stroke-color": "#3b82f6",
            "circle-stroke-width": 2,
            "circle-stroke-opacity": 0.9,
          },
        });
      }
      const source = instance.getSource("geofence-radius");
      if (source) {
        (source as maplibregl.GeoJSONSource).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [position.lng, position.lat] },
        });
      }
      instance.setPaintProperty(
        "geofence-radius-fill",
        "circle-radius",
        radiusPixels(instance, position.lng, position.lat, parsedRadius),
      );
    }

    instance.addControl(new maplibregl.NavigationControl(), "top-right");
    instance.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "top-right");
    instance.on("load", drawRadius);
    instance.on("move", drawRadius);
    instance.on("zoom", drawRadius);
    instance.on("click", (event) => {
      point.setLngLat(event.lngLat);
      syncMarker();
      drawRadius();
    });
    point.on("dragend", () => {
      syncMarker();
      drawRadius();
    });
    map.current = instance;
    marker.current = point;

    return () => {
      marker.current = null;
      map.current = null;
      try {
        instance.remove();
      } catch {
        /* ya removido */
      }
    };
  }, [hasRadius, parsedRadius, hasValidLocation, startLocation]);

  /** @summary Actualiza manualmente una coordenada y reposiciona el mapa y su marcador. */
  function updateCoordinates(nextLatitude: number, nextLongitude: number) {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) return;
    marker.current?.setLngLat([nextLongitude, nextLatitude]);
    map.current?.easeTo({ center: [nextLongitude, nextLatitude], duration: 450 });
    if (hasRadius && map.current) {
      const position = marker.current?.getLngLat();
      if (position) {
        map.current.setPaintProperty(
          "geofence-radius-fill",
          "circle-radius",
          radiusPixels(map.current, position.lng, position.lat, parsedRadius),
        );
      }
    }
  }

  return (
    <fieldset className="min-w-0 md:col-span-2">
      <legend className="text-sm font-bold text-zinc-200">Ubicación en el mapa</legend>
      {hasRadius && (
        <p className="mt-1 text-sm text-zinc-500">
          El círculo azul marca el área de {Math.round(parsedRadius)} m alrededor del local para pedidos de mesa.
        </p>
      )}
      <p className="mt-1 text-sm text-zinc-500">
        Hacé clic sobre el mapa o arrastrá el marcador rosa hasta la entrada del local.
      </p>
      <div className="mt-3 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900">
        {mapFailed || !hasValidLocation ? (
          <div className="grid h-96 w-full place-items-center p-6 text-center text-sm text-zinc-400">
            <div>
              <p className="font-bold text-zinc-200">Vista de mapa no disponible</p>
              <p className="mt-1">
                No se pudo cargar el proveedor de tiles. Podés ingresar las coordenadas manualmente abajo.
              </p>
            </div>
          </div>
        ) : (
          <div ref={container} className="h-96 w-full" aria-label="Selector de ubicación del negocio" />
        )}
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
