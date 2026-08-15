"use client";

import { createElement, forwardRef, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/components/analytics/tracker";
import { PRODUCT_IMAGE_FALLBACK } from "@/lib/image-fallback";

type ViewerElement = HTMLElement & {
  canActivateAR: boolean;
  loaded?: boolean;
  modelIsVisible?: boolean;
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
  arEnabled?: boolean;
  compact?: boolean;
  productId?: number;
};

const ModelViewerCanvas = forwardRef<ViewerElement, Record<string, unknown>>(
  /** @summary Adapta el elemento web de Google para utilizar una referencia segura desde React. */
  function ModelViewerCanvas(properties, reference) {
    return createElement("model-viewer", { ...properties, ref: reference });
  },
);

/** @summary Reconoce iPhone y iPad, incluidos los modelos recientes que se identifican como una computadora Mac. */
function isAppleMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

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
  arEnabled = true,
  compact = false,
  productId,
}: ModelExperienceProps) {
  const viewer = useRef<ViewerElement | null>(null);
  const [requested, setRequested] = useState(false);
  const [libraryReady, setLibraryReady] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [arAvailable, setArAvailable] = useState(false);
  const [quickLookAvailable, setQuickLookAvailable] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retryToken, setRetryToken] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!requested) return;
    let active = true;

    import("@google/model-viewer")
      .then(async () => {
        await customElements.whenDefined("model-viewer");
        if (active) setLibraryReady(true);
      })
      .catch(() => {
        if (!active) return;
        setLoadError("No se pudo iniciar el visor 3D. Revisá la conexión y volvé a intentarlo.");
      });

    return () => {
      active = false;
    };
  }, [requested, retryToken]);

  useEffect(() => {
    const element = viewer.current;
    if (!libraryReady || !element) return;

    /** @summary Actualiza los controles cuando el archivo 3D termina de cargarse. */
    const handleLoad = () => {
      setModelReady(true);
      setLoadError("");
      const supportsAr = arEnabled && Boolean(element.canActivateAR);
      setArAvailable(supportsAr);
      setMessage(
        supportsAr
          ? "Modelo listo. También podés ubicarlo sobre una superficie real."
          : arEnabled
            ? "Modelo listo. AR no está disponible en este dispositivo, pero el visor 3D funciona normalmente."
            : "Modelo listo para girar, ampliar y explorar en tres dimensiones.",
      );
    };

    /** @summary Explica una falla de descarga o lectura del modelo y ofrece una recuperación visible. */
    const handleError = () => {
      setModelReady(false);
      setArAvailable(false);
      setLoadError(
        "El archivo 3D no pudo abrirse en este dispositivo. Podés reintentar sin recargar la página.",
      );
      setMessage("");
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
    element.addEventListener("error", handleError);
    element.addEventListener("ar-status", handleArStatus);
    if (element.loaded || element.modelIsVisible) handleLoad();
    return () => {
      element.removeEventListener("load", handleLoad);
      element.removeEventListener("error", handleError);
      element.removeEventListener("ar-status", handleArStatus);
    };
  }, [arEnabled, libraryReady]);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  /** @summary Solicita una experiencia AR real desde una interacción directa del visitante. */
  async function openAugmentedReality() {
    if (!arEnabled || !viewer.current?.canActivateAR) {
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
    if (!viewer.current) return;
    try {
      if (viewer.current.requestFullscreen) {
        await viewer.current.requestFullscreen();
        return;
      }
    } catch {
      // iPhone no expone Fullscreen API para elementos arbitrarios; usa el modo ampliado propio.
    }
    setExpanded(true);
  }

  /** @summary Reinicia la carga del componente y del modelo sin perder la ubicación actual del visitante. */
  function retry() {
    setModelReady(false);
    setArAvailable(false);
    setLoadError("");
    setMessage("");
    setRetryToken((current) => current + 1);
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
              setLoadError("");
              setQuickLookAvailable(Boolean(iosUrl) && isAppleMobileDevice());
              trackEvent("model.open", {
                entityType: productId ? "product" : undefined,
                entityId: productId,
              });
            }}
            type="button"
          >
            <span className="md:hidden">{arEnabled ? "Ver en 3D y en tu mesa" : "Ver en 3D"}</span>
            <span className="hidden md:inline">Abrir visor 3D</span>
          </button>
        </div>
      </section>
    );
  }

  const viewerProperties: Record<string, unknown> = {
    src: modelUrl,
    alt: `Modelo 3D de ${productName}`,
    "camera-controls": true,
    "touch-action": "pan-y",
    "shadow-intensity": "1",
    "shadow-softness": "0.8",
    "interaction-prompt": "auto",
    "interaction-prompt-style": "wiggle",
    orientation,
    scale: `${scale} ${scale} ${scale}`,
    loading: "lazy",
    "xr-environment": true,
    ...(iosUrl ? { "ios-src": iosUrl } : {}),
    ...(posterUrl ? { poster: posterUrl } : {}),
    ...(arEnabled
      ? {
          ar: true,
          "ar-modes": "webxr scene-viewer quick-look",
          "ar-scale": allowScale ? "auto" : "fixed",
          "ar-placement": placement,
        }
      : {}),
    style: {
      width: "100%",
      height: expanded ? "calc(100dvh - 9rem)" : compact ? "320px" : "min(68vh, 680px)",
      background: "#09090b",
    },
  };

  return (
    <section
      className={`overflow-hidden border border-white/10 bg-zinc-950 ${
        expanded
          ? "fixed inset-0 z-[200] rounded-none bg-black p-[max(env(safe-area-inset-top),0px)_0_max(env(safe-area-inset-bottom),0px)]"
          : "rounded-[2rem]"
      }`}
    >
      {expanded && (
        <div className="flex min-h-14 items-center justify-between border-b border-white/10 px-4">
          <strong className="truncate pr-3">{productName}</strong>
          <button className="btn btn-secondary min-h-11" onClick={() => setExpanded(false)} type="button">
            Cerrar
          </button>
        </div>
      )}
      <div className="relative">
        {libraryReady && !loadError ? (
          <ModelViewerCanvas {...viewerProperties} key={retryToken} ref={viewer} />
        ) : loadError ? (
          <div
            className={`grid place-items-center px-6 text-center ${compact ? "h-80" : "h-[min(68vh,680px)]"}`}
            role="alert"
          >
            <div className="max-w-md">
              <p className="font-bold text-amber-200">{loadError}</p>
              <button className="btn mt-5 min-h-12" onClick={retry} type="button">
                Reintentar visor 3D
              </button>
            </div>
          </div>
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
          {arEnabled && arAvailable && (
            <button className="btn" disabled={!modelReady} onClick={openAugmentedReality} type="button">
              Ver en tu mesa
            </button>
          )}
          {arEnabled && !arAvailable && quickLookAvailable && iosUrl && (
            <a className="btn" href={iosUrl} rel="ar">
              {createElement("img", {
                src: posterUrl || PRODUCT_IMAGE_FALLBACK,
                alt: "",
                "aria-hidden": true,
                style: { display: "none" },
              })}
              Ver en tu mesa
            </a>
          )}
          <button className="btn btn-secondary" disabled={!modelReady} onClick={downloadView} type="button">
            Descargar captura 3D
          </button>
          <button className="btn btn-secondary" disabled={!modelReady} onClick={openFullscreen} type="button">
            {expanded ? "Vista ampliada" : "Ampliar visor"}
          </button>
        </div>
        <p className="mt-3 min-h-5 text-sm text-zinc-400" role="status" aria-live="polite">
          {message || "Cargando el producto…"}
        </p>
      </div>
    </section>
  );
}
