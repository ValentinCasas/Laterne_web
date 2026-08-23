"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { scopedFetch } from "@/lib/client-routing";
import { Drawer } from "@/components/admin/ui/drawer";
import { Icon } from "@/components/admin/ui/icons";
import { deliveryStatusMeta } from "@/lib/delivery-drivers";

const SWAL_THEME = { background: "#18181b", color: "#fafafa" };

type StopItem = {
  id: number;
  routeOrder: number;
  customerName: string;
  address: string;
  status: string;
  reference?: string | null;
};

/** @summary Drawer para reordenar paradas del recorrido con drag & drop y edición por número. */
export function ReorderStopsDrawer({
  open,
  onClose,
  routeId,
  stops,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  routeId: number;
  stops: StopItem[];
  onSaved: () => void;
}) {
  // Only non-delivered stops can be reordered
  const deliveredStops = useMemo(() => stops.filter((s) => s.status === "DELIVERED"), [stops]);
  const reorderableStops = useMemo(() => stops.filter((s) => s.status !== "DELIVERED"), [stops]);

  const [items, setItems] = useState<StopItem[]>(() => [...reorderableStops]);

  /** Rebuild items when drawer opens (key-based reset from parent). */
  const [prevStopsKey, setPrevStopsKey] = useState(() => stops.map((s) => s.id).join(","));
  const currentKey = stops.map((s) => s.id).join(",");
  if (prevStopsKey !== currentKey) {
    setPrevStopsKey(currentKey);
    setItems([...reorderableStops]);
  }
  const [working, setWorking] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);



  /* ── Drag & Drop ── */
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    dragOverIndex.current = index;
  }, []);

  const handleDrop = useCallback((index: number) => {
    const from = dragIndex;
    if (from === null || from === index) { setDragIndex(null); return; }
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(null);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
  }, []);

  /* ── Number edit: change position by typing ── */
  const moveToPosition = useCallback((currentIndex: number, newPosition: number) => {
    const clamped = Math.max(1, Math.min(items.length, newPosition));
    if (clamped === currentIndex + 1) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(currentIndex, 1);
      if (moved) next.splice(clamped - 1, 0, moved);
      return next;
    });
  }, [items.length]);

  /* ── Reset to original order ── */
  const handleReset = useCallback(() => {
    setItems([...reorderableStops]);
  }, [reorderableStops]);

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    setWorking(true);
    try {
      // Build the full order: delivered stops keep their original positions,
      // reorderable stops get new positions starting after delivered ones.
      const allStops: StopItem[] = [];
      let orderCounter = 1;

      // First, place delivered stops at their original positions
      for (const ds of deliveredStops) {
        allStops.push({ ...ds, routeOrder: orderCounter });
        orderCounter++;
      }

      // Then, place reorderable stops in the new order
      for (const rs of items) {
        allStops.push({ ...rs, routeOrder: orderCounter });
        orderCounter++;
      }

      const payload = allStops.map((s) => ({ deliveryId: s.id, routeOrder: s.routeOrder }));

      const response = await scopedFetch(`/api/driver/routes/${routeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stops: payload }),
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        await Swal.fire({ title: "No se pudo guardar", text: body.error ?? "Intentá de nuevo.", icon: "error", ...SWAL_THEME });
        return;
      }
      await Swal.fire({ title: "Orden actualizado", icon: "success", timer: 1200, showConfirmButton: false, ...SWAL_THEME });
      onSaved();
      onClose();
    } finally {
      setWorking(false);
    }
  }, [items, deliveredStops, routeId, onSaved, onClose]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Ordenar recorrido"
      width="420px"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-white transition hover:bg-white/10"
            onClick={handleReset}
            disabled={working}
          >
            <Icon name="refresh" className="h-4 w-4" />
            Restablecer
          </button>
          <button
            type="button"
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-2xl bg-pink-600 px-4 text-xs font-black text-white shadow-lg shadow-pink-950/30 transition hover:bg-pink-500 active:scale-[.99] disabled:opacity-50"
            onClick={() => void handleSave()}
            disabled={working || items.length === 0}
          >
            {working ? <Icon name="loader" className="h-4 w-4 animate-spin" /> : <Icon name="check-circle" className="h-4 w-4" />}
            Guardar orden
          </button>
        </div>
      }
    >
      <p className="mb-4 text-xs text-zinc-500">
        Arrastrá las paradas para definir el orden de entrega. Las entregadas se mantienen en su posición.
      </p>

      {/* Delivered stops (fixed, not reorderable) */}
      {deliveredStops.length > 0 && (
        <div className="mb-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">Completadas</p>
          <div className="space-y-2">
            {deliveredStops.map((stop, i) => (
              <StopRow key={stop.id} stop={stop} position={i + 1} delivered locked />
            ))}
          </div>
        </div>
      )}

      {/* Reorderable stops */}
      {items.length > 0 ? (
        <div>
          {deliveredStops.length > 0 && (
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-zinc-600">
              Pendientes (arrastrá para reordenar)
            </p>
          )}
          <div className="space-y-2">
            {items.map((stop, i) => {
              const globalPosition = deliveredStops.length + i + 1;
              return (
                <StopRow
                  key={stop.id}
                  stop={stop}
                  position={globalPosition}
                  dragIndex={dragIndex}
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={() => handleDrop(i)}
                  onDragEnd={handleDragEnd}
                  onMoveTo={(pos) => moveToPosition(i, pos)}
                  isDragging={dragIndex === i}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[.015] p-8 text-center">
          <p className="text-sm text-zinc-500">No hay paradas pendientes para reordenar.</p>
        </div>
      )}

      {/* Preview */}
      <div className="mt-4 rounded-2xl border border-white/5 bg-white/[.02] p-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">Vista previa del orden</p>
        <p className="mt-2 text-xs text-zinc-400">
          {deliveredStops.length > 0 && `✓ ${deliveredStops.length} completada${deliveredStops.length > 1 ? "s" : ""}`}
          {deliveredStops.length > 0 && items.length > 0 && " → "}
          {items.length > 0 && `${items.length} pendiente${items.length > 1 ? "s" : ""}`}
          {" "}en total
        </p>
      </div>
    </Drawer>
  );
}

/* ── Individual Stop Row ── */

function StopRow({
  stop,
  position,
  delivered,
  locked,

  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveTo,
  isDragging,
}: {
  stop: StopItem;
  position: number;
  delivered?: boolean;
  locked?: boolean;
  dragIndex?: number | null;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  onDragEnd?: () => void;
  onMoveTo?: (pos: number) => void;
  isDragging?: boolean;
}) {
  const meta = deliveryStatusMeta(stop.status);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(position));

  const commitEdit = () => {
    const num = parseInt(editValue, 10);
    if (!isNaN(num) && onMoveTo) onMoveTo(num);
    setEditing(false);
  };

  return (
    <div
      draggable={!locked}
      onDragStart={() => onDragStart?.()}
      onDragOver={onDragOver}
      onDrop={() => onDrop?.()}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-3 rounded-2xl border p-3 transition-all duration-200 ${
        isDragging
          ? "border-pink-400/30 bg-pink-500/[.08] opacity-70"
          : delivered
            ? "border-emerald-400/15 bg-emerald-500/[.04]"
            : "border-white/[.08] bg-zinc-900/80 hover:border-white/[.14]"
      } ${locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
    >
      {/* Drag handle */}
      {!locked && (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-zinc-600">
          <Icon name="menu" className="h-4 w-4" />
        </span>
      )}

      {/* Position number */}
      {editing ? (
        <input
          type="number"
          min={1}
          className="h-8 w-12 rounded-lg border border-pink-400/30 bg-zinc-800 px-2 text-center text-sm font-black text-white"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditValue(String(position)); setEditing(false); } }}
          autoFocus
        />
      ) : (
        <button
          type="button"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
            delivered ? "bg-emerald-500/20 text-emerald-300" : "bg-pink-500/15 text-pink-300"
          } ${!locked ? "hover:bg-pink-500/25 cursor-pointer" : ""}`}
          onClick={() => { if (!locked) { setEditValue(String(position)); setEditing(true); } }}
          title={locked ? "Posición fija" : "Click para cambiar posición"}
        >
          {delivered ? "✓" : position}
        </button>
      )}

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{stop.customerName}</p>
        <p className="mt-0.5 truncate text-[11px] text-zinc-500">{stop.address}</p>
      </div>

      {/* Status badge */}
      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black ${meta.badge}`}>
        {meta.label}
      </span>
    </div>
  );
}
