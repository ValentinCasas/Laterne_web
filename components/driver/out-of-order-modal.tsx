"use client";

import { Icon } from "@/components/admin/ui/icons";

/** @summary Modal de confirmación para entregas fuera del orden planificado. */
export function OutOfOrderConfirmModal({
  open,
  onClose,
  onConfirm,
  targetStop,
  expectedStop,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  targetStop: { stopNum: number; customerName: string; address?: string } | null;
  expectedStop: { stopNum: number; customerName: string; address?: string } | null;
}) {
  if (!open || !targetStop || !expectedStop) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="ooo-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/[.1] bg-zinc-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-500/15">
            <Icon name="alert-triangle" className="h-6 w-6 text-amber-300" />
          </span>
          <div>
            <h2 id="ooo-title" className="text-lg font-black text-white">Entrega fuera de orden</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Esta entrega está fuera del orden del recorrido.
            </p>
          </div>
        </div>

        {/* Target stop */}
        <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/70">Estás por entregar</p>
          <p className="mt-1 text-base font-black text-white">
            #{targetStop.stopNum} · {targetStop.customerName}
          </p>
          {targetStop.address && (
            <p className="mt-0.5 text-xs text-zinc-400 truncate">{targetStop.address}</p>
          )}
        </div>

        {/* Expected stop */}
        <div className="mt-3 rounded-2xl border border-white/[.08] bg-white/[.03] p-4">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Próxima parada prevista</p>
          <p className="mt-1 text-sm font-bold text-zinc-300">
            #{expectedStop.stopNum} · {expectedStop.customerName}
          </p>
          {expectedStop.address && (
            <p className="mt-0.5 text-xs text-zinc-500 truncate">{expectedStop.address}</p>
          )}
        </div>

        {/* Explanation */}
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          Si confirmás, la entrega se marcará como completada y el recorrido se actualizará al orden real ejecutado.
        </p>

        {/* Actions */}
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white transition hover:bg-white/10 active:scale-[.99]"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-4 text-sm font-black text-white shadow-lg shadow-amber-950/30 transition hover:bg-amber-500 active:scale-[.99]"
            onClick={onConfirm}
          >
            <Icon name="check" className="h-4 w-4" />
            Sí, entregar y reordenar
          </button>
        </div>
      </div>
    </div>
  );
}
