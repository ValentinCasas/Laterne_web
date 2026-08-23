"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { Icon } from "@/components/admin/ui/icons";

const SWAL_THEME = { background: "#18181b", color: "#fafafa" };

/** @summary Modal para editar dirección, referencia y ubicación de una parada del recorrido. */
export function EditAddressModal({
  deliveryId,
  currentAddress,
  currentReference,
  currentLat,
  currentLng,
  onClose,
  onSaved,
}: {
  deliveryId: number;
  currentAddress: string;
  currentReference?: string | null;
  currentLat?: number | null;
  currentLng?: number | null;
  onClose: () => void;
  onSaved?: (updated: { deliveryAddress: string; latitude: number; longitude: number }) => void;
}) {
  const [address, setAddress] = useState(currentAddress);
  const [reference, setReference] = useState(currentReference ?? "");
  const [lat, setLat] = useState(currentLat ?? -34.6037);
  const [lng, setLng] = useState(currentLng ?? -58.3816);
  const [working, setWorking] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  /* ── Map init ── */
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

    const initialLng = currentLng ?? -58.3816;
    const initialLat = currentLat ?? -34.6037;

    try {
      const map = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [initialLng, initialLat],
        zoom: 15,
        cooperativeGestures: true,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      const marker = new maplibregl.Marker({ draggable: true, color: "#ec4899" })
        .setLngLat([initialLng, initialLat])
        .addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLngLat();
        setLng(pos.lng);
        setLat(pos.lat);
      });

      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        setLng(e.lngLat.lng);
        setLat(e.lngLat.lat);
      });

      mapRef.current = map;
      markerRef.current = marker;
    } catch {
      /* map failed to init */
    }

    return () => {
      try { mapRef.current?.remove(); } catch { /* already removed */ }
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Sync marker when lat/lng changes externally ── */
  useEffect(() => {
    if (!markerRef.current) return;
    const current = markerRef.current.getLngLat();
    if (Math.abs(current.lng - lng) > 0.00001 || Math.abs(current.lat - lat) > 0.00001) {
      markerRef.current.setLngLat([lng, lat]);
    }
  }, [lat, lng]);

  /* ── Center map on current position button ── */
  const centerOnPosition = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 16, duration: 400 });
    }
  }, [lat, lng]);

  /* ── Save ── */
  async function handleSave() {
    if (!address.trim()) return;
    setWorking(true);
    try {
      const response = await scopedFetch(`/api/driver/deliveries/${deliveryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryAddress: address.trim(),
          reference: reference.trim() || undefined,
          latitude: lat,
          longitude: lng,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: unknown; error?: string };
      if (!response.ok) {
        await Swal.fire({ title: "No se pudo guardar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      onSaved?.({ deliveryAddress: address.trim(), latitude: lat, longitude: lng });
      await Swal.fire({ title: "Dirección actualizada", icon: "success", timer: 1200, showConfirmButton: false, ...SWAL_THEME });
      onClose();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-base font-black text-white">Editar dirección</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Corregí la dirección o reposicioná el punto en el mapa</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-zinc-400 hover:text-white" aria-label="Cerrar">
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5">
          {/* Address field */}
          <label className="block text-xs font-bold text-zinc-300">
            Dirección
            <input
              type="text"
              className="input mt-2 w-full"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Dirección de entrega"
            />
          </label>

          {/* Reference field */}
          <label className="mt-3 block text-xs font-bold text-zinc-300">
            Referencia
            <input
              type="text"
              className="input mt-2 w-full"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej: Departamento 4B, timbre colorado"
            />
          </label>

          {/* Coords display */}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-zinc-500">
            <Icon name="map-pin" className="h-3 w-3" />
            {lat.toFixed(5)}, {lng.toFixed(5)}
            <button type="button" onClick={centerOnPosition} className="ml-auto text-pink-400 hover:text-pink-300 font-bold">
              Centrar
            </button>
          </div>

          {/* Map */}
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
            <div ref={mapContainer} className="h-52 w-full sm:h-64" />
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">
            Hacé click en el mapa o arrastrá el marker para reposicionar
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-white/5 px-5 py-4">
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-xs font-bold text-white transition hover:bg-white/10"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-pink-600 text-xs font-black text-white shadow-lg shadow-pink-950/30 transition hover:bg-pink-500 active:scale-[.99] disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={working || !address.trim()}
          >
            {working ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="check-circle" className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
