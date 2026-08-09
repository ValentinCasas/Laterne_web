"use client";

import { useRef, useState } from "react";
import { ModelExperience } from "@/components/products/model-experience";

/** @summary Permite reemplazar o quitar un modelo 3D conservando una referencia visible al archivo actual. */
export function AssetPicker({
  name,
  label,
  value,
  accept,
  help,
  previewModel,
}: {
  name: string;
  label: string;
  value: string;
  accept: string;
  help?: string;
  previewModel?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [currentValue, setCurrentValue] = useState(value);
  const [pendingName, setPendingName] = useState("");

  /** @summary Registra el archivo elegido para mostrar su nombre antes de guardar el producto. */
  function selectPendingFile(file?: File) {
    setPendingName(file?.name ?? "");
  }

  /** @summary Elimina la referencia actual y cualquier selección todavía no enviada. */
  function clearSelection() {
    setCurrentValue("");
    setPendingName("");
    if (input.current) input.current.value = "";
  }

  return (
    <fieldset className="min-w-0 rounded-2xl border border-white/10 bg-white/[.025] p-4 md:col-span-2">
      <legend className="px-2 text-sm font-bold text-zinc-200">{label}</legend>
      <input name={name} type="hidden" value={currentValue} />

      <div className="flex flex-wrap items-center gap-3">
        <label className="btn btn-secondary cursor-pointer">
          {currentValue || pendingName ? "Reemplazar archivo" : "Elegir archivo"}
          <input
            ref={input}
            className="sr-only"
            name={`${name}File`}
            type="file"
            accept={accept}
            onChange={(event) => selectPendingFile(event.target.files?.[0])}
          />
        </label>
        {(currentValue || pendingName) && (
          <button
            className="rounded-xl px-4 py-3 text-sm font-bold text-red-300 hover:bg-red-500/10"
            onClick={clearSelection}
            type="button"
          >
            Quitar modelo
          </button>
        )}
      </div>

      <div className="mt-3 rounded-xl bg-black/30 p-3 text-sm text-zinc-400">
        {pendingName ? (
          <p>
            Nuevo archivo: <strong className="text-zinc-200">{pendingName}</strong>
          </p>
        ) : currentValue ? (
          <p className="break-all">
            Archivo actual: <strong className="text-zinc-200">{currentValue}</strong>
          </p>
        ) : (
          <p>Todavía no hay un archivo configurado.</p>
        )}
        {help && <p className="mt-1 text-xs text-zinc-600">{help}</p>}
      </div>

      {previewModel && currentValue && !pendingName && (
        <div className="mt-4">
          <ModelExperience modelUrl={currentValue} productName="Vista previa administrativa" compact />
        </div>
      )}
    </fieldset>
  );
}
