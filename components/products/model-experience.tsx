"use client";

import { createElement, forwardRef, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/components/analytics/tracker";

type ViewerElement = HTMLElement & {
  canActivateAR: boolean;
  activateAR(): Promise<void>;
  toBlob(options?: { mimeType?: string; qualityArgument?: number; idealAspect?: boolean }): Promise<Blob>;
};

type ModelExperienceProps = {
  modelUrl: string;
  iosUrl?: string | null;
  posterUrl?: string | null;
  productName: string;
  scale?: number;
  orientation?: string;
  placement?: "floor" | "wall";
  allowScale?: boolean;
  compact?: boolean;
  productId?: number;
};

const ModelViewerCanvas = forwardRef<ViewerElement, Record<string, unknown>>(
  /** @summary Adapta el elemento web de Google para utilizar una referencia segura desde React. */
  function ModelViewerCanvas(properties, reference) {
    return createElement("model-viewer", { ...properties, ref: reference });
  },
);

/** @summary Presenta un modelo bajo demanda y activa WebXR, Scene Viewer o Quick Look cuando corresponde. */
export function ModelExperience({
  modelUrl,
  iosUrl,
  posterUrl,
  productName,
  scale = 1,
  orientation = "0deg 0deg 0deg",
  placement = "floor",
  allowScale = true,
  compact = false,
  productId,
}: ModelExperienceProps) {
  const viewer = useRef<ViewerElement | null>(null);
  const [requested, setRequested] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [arAvailable, setArAvailable] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!requested) return;
    let active = true;

    import("@google/model-viewer").then(() => {
      if (active) setLibraryReady(true);
    });

    return () => {
      active = false;
    };
  }, [requested]);

  useEffect(() => {
    const element = viewer.current;
    if (!libraryReady || !element) return;

    /** @summary Actualiza los controles cuando el archivo 3D termina de cargarse. */
    const handleLoad = () => {
      setModelReady(true);
      const supportsAr = Boolean(element.canActivateAR);
      setArAvailable(supportsAr);
      setMessage(
        supportsAr
          ? "Modelo listo. También podés ubicarlo sobre una superficie real."
          : "Modelo listo. AR no está disponible en este dispositivo, pero el visor 3D funciona normalmente.",
      );
    };

    /** @summary Traduce el estado nativo de realidad aumentada a un mensaje comprensible. */
    const handleArStatus = (event: Event) => {
      const status = (event as CustomEvent<{ status?: string }>).detail?.status;
      if (status === "session-started") setMessage("Mové el celular lentamente para detectar la mesa.");
      if (status === "object-placed")
        setMessage("Producto ubicado. Podés moverlo, rotarlo o ajustar su tamaño.");
      if (status === "failed") {
        setArAvailable(false);
        setMessage("Este dispositivo no pudo abrir AR. El visor 3D sigue disponible.");
      }
    };

    element.addEventListener("load", handleLoad);
    element.addEventListener("ar-status", handleArStatus);
    return () => {
      element.removeEventListener("load", handleLoad);
      element.removeEventListener("ar-status", handleArStatus);
    };
  }, [libraryReady]);

  /** @summary Solicita una experiencia AR real desde una interacción directa del visitante. */
  async function openAugmentedReality() {
    if (!viewer.current?.canActivateAR) {
      setArAvailable(false);
      setMessage("AR no está disponible en este dispositivo. Podés seguir usando el visor 3D.");
      return;
    }

    try {
      trackEvent("ar.started", { entityType: productId ? "product" : undefined, entityId: productId });
      await viewer.current.activateAR();
    } catch {
      setMessage("No se pudo iniciar la cámara. Revisá los permisos y asegurate de usar HTTPS.");
    }
  }

  /** @summary Descarga una captura PNG de la vista tridimensional elegida por el visitante. */
  async function downloadView() {
    if (!viewer.current || !modelReady) return;
    try {
      const blob = await viewer.current.toBlob({ mimeType: "image/png", idealAspect: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${productName.toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-")}-3d.png`;
      link.click();
      trackEvent("model.screenshot", { entityType: productId ? "product" : undefined, entityId: productId });
      URL.revokeObjectURL(url);
      setMessage("Captura 3D descargada.");
    } catch {
      setMessage("No se pudo generar la captura en este navegador.");
    }
  }

  /** @summary Amplía el visor para explorar el producto sin distracciones. */
  async function openFullscreen() {
    if (!viewer.current?.requestFullscreen) return;
    await viewer.current.requestFullscreen();
  }

  if (!requested) {
    return (
      <section
        className={`relative grid place-items-center overflow-hidden rounded-[2rem] border border-pink-500/25 bg-gradient-to-br from-pink-950/30 to-zinc-950 p-6 text-center ${compact ? "min-h-64" : "min-h-[420px]"}`}
        style={
          posterUrl
            ? {
                backgroundImage: `linear-gradient(rgba(9,9,11,.82),rgba(9,9,11,.94)),url(${posterUrl})`,
                backgroundPosition: "center",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        <div className="max-w-md">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-pink-500/15 text-3xl">
            3D
          </span>
          <h2 className="mt-4 text-2xl font-black">Explorá {productName} en tres dimensiones</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            El modelo se descarga únicamente cuando lo solicitás para cuidar tus datos y el rendimiento.
          </p>
          <button
            className="btn mt-5"
            onClick={() => {
              setRequested(true);
              trackEvent("model.open", {
                entityType: productId ? "product" : undefined,
                entityId: productId,
              });
            }}
            type="button"
          >
            <span className="md:hidden">Ver en 3D y en tu mesa</span>
            <span className="hidden md:inline">Abrir visor 3D</span>
          </button>
        </div>
      </section>
    );
  }

  const viewerProperties: Record<string, unknown> = {
    src: modelUrl,
    alt: `Modelo 3D de ${productName}`,
    ar: true,
    "ar-modes": "webxr scene-viewer quick-look",
    "ar-scale": allowScale ? "auto" : "fixed",
    "ar-placement": placement,
    "camera-controls": true,
    "touch-action": "pan-y",
    "shadow-intensity": "1",
    "shadow-softness": "0.8",
    "interaction-prompt": "auto",
    orientation,
    scale: `${scale} ${scale} ${scale}`,
    loading: "lazy",
    "xr-environment": true,
    ...(iosUrl ? { "ios-src": iosUrl } : {}),
    ...(posterUrl ? { poster: posterUrl } : {}),
    style: { width: "100%", height: compact ? "320px" : "min(68vh, 680px)", background: "#09090b" },
  };

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950">
      <div className="relative">
        {libraryReady ? (
          <ModelViewerCanvas {...viewerProperties} ref={viewer} />
        ) : (
          <div
            className={`grid place-items-center ${compact ? "h-80" : "h-[min(68vh,680px)]"}`}
            role="status"
          >
            <span className="animate-pulse font-bold text-pink-300">Preparando el visor 3D…</span>
          </div>
        )}
        {!modelReady && libraryReady && (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 overflow-hidden bg-zinc-800">
            <span className="block h-full w-1/2 animate-pulse bg-pink-500" />
          </div>
        )}
      </div>
      <div className="border-t border-white/10 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {arAvailable && (
            <button className="btn" disabled={!modelReady} onClick={openAugmentedReality} type="button">
              Ver en tu mesa
            </button>
          )}
          <button className="btn btn-secondary" disabled={!modelReady} onClick={downloadView} type="button">
            Descargar captura 3D
          </button>
          <button className="btn btn-secondary" disabled={!modelReady} onClick={openFullscreen} type="button">
            Pantalla completa
          </button>
        </div>
        <p className="mt-3 min-h-5 text-sm text-zinc-400" role="status" aria-live="polite">
          {message || "Cargando el producto…"}
        </p>
      </div>
    </section>
  );
}
