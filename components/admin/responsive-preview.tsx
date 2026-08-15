"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";

/**
 * Marco de vista previa responsive tipo DevTools.
 *
 * El contenido se renderiza dentro de un iframe con el ancho real indicado, por
 * eso los breakpoints de Tailwind reaccionan de verdad al cambiar el tamaño
 * (los `md:`/`lg:` se evalúan contra el viewport del iframe, no contra el del
 * Admin). Se copian las hojas de estilo del documento padre y las variables de
 * paleta del negocio para que el resultado coincida con la página pública.
 */

type Preset = {
  key: string;
  label: string;
  width: number | null;
  height?: number;
};

const PRESETS: Preset[] = [
  { key: "responsive", label: "Responsive", width: null },
  { key: "mobile-s", label: "Mobile S", width: 320, height: 568 },
  { key: "mobile-m", label: "Mobile M", width: 375, height: 812 },
  { key: "mobile-l", label: "Mobile L", width: 390, height: 844 },
  { key: "mobile-xl", label: "Mobile XL", width: 430, height: 932 },
  { key: "tablet", label: "Tablet", width: 768, height: 1024 },
  { key: "notebook", label: "Notebook", width: 1024, height: 768 },
  { key: "desktop", label: "Desktop", width: 1366, height: 800 },
  { key: "desktop-xl", label: "Desktop XL", width: 1440, height: 800 },
];

const MIN_WIDTH = 240;
const MAX_WIDTH = 1600;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 1200;

export type ResponsivePreviewHandle = {
  /** Hace scroll dentro del iframe hasta el elemento con el id indicado. */
  scrollToId: (id: string) => void;
};

type ResponsivePreviewProps = {
  /** Clase aplicada al body del iframe (p. ej. `tenant-theme` para la paleta real). */
  bodyClass?: string;
  /** Estilos aplicados al body del iframe (variables de paleta, fondo y fuente). */
  bodyStyle?: CSSProperties;
  children: React.ReactNode;
};

export const ResponsivePreview = forwardRef<ResponsivePreviewHandle, ResponsivePreviewProps>(
  function ResponsivePreview({ bodyClass, bodyStyle, children }, ref) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const docRef = useRef<Document | null>(null);
    const [frameDoc, setFrameDoc] = useState<Document | null>(null);
    const [preset, setPreset] = useState<Preset>(PRESETS[0]);
    const [width, setWidth] = useState<number | null>(null);
    const [height, setHeight] = useState<number | null>(null);
    const [resizing, setResizing] = useState<"width" | "height" | null>(null);
    const [frameSize, setFrameSize] = useState<{ width: number; height: number } | null>(null);
    const bodyConfigRef = useRef({ bodyClass, bodyStyle });
    bodyConfigRef.current = { bodyClass, bodyStyle };

    /** @summary Aplica la clase y los estilos del negocio al body del iframe. */
    const applyBody = useCallback((doc?: Document | null) => {
      const target = doc ?? docRef.current;
      if (!target) return;
      const { bodyClass: nextClass, bodyStyle: nextStyle } = bodyConfigRef.current;
      if (nextClass !== undefined) target.body.className = nextClass;
      if (nextStyle) Object.assign(target.body.style, nextStyle);
    }, []);

    /** @summary Copia estilos del documento padre al iframe para que el preview luzca como la web real. */
    const prepareDocument = useCallback(() => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      if (!doc) return;
      const head = doc.head;
      head.querySelectorAll("[data-preview-style]").forEach((node) => node.remove());
      for (const node of Array.from(document.head.children)) {
        if (node.tagName === "LINK" && node.getAttribute("rel") === "stylesheet") {
          const link = doc.createElement("link");
          link.rel = "stylesheet";
          link.href = node.getAttribute("href") ?? "";
          link.dataset.previewStyle = "true";
          head.appendChild(link);
        } else if (node.tagName === "STYLE" && node.textContent) {
          const style = doc.createElement("style");
          style.dataset.previewStyle = "true";
          style.textContent = node.textContent;
          head.appendChild(style);
        }
      }
      const base = doc.createElement("style");
      base.dataset.previewStyle = "true";
      base.textContent =
        "html,body{margin:0;padding:0;min-height:100%}html{overflow-x:hidden}body{overflow-x:hidden;-webkit-text-size-adjust:100%;text-size-adjust:100%}";
      head.appendChild(base);
      docRef.current = doc;
      applyBody(doc);
      setFrameDoc(doc);
    }, [applyBody]);

    useEffect(() => {
      prepareDocument();
    }, [prepareDocument]);

    useEffect(() => {
      applyBody();
    }, [applyBody, frameDoc, bodyClass, bodyStyle]);

    useEffect(() => {
      const frame = frameRef.current;
      if (!frame) return;
      const observer = new ResizeObserver(([entry]) => {
        setFrameSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
      });
      observer.observe(frame);
      return () => observer.disconnect();
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        scrollToId(id) {
          docRef.current?.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      }),
      [],
    );

    function selectPreset(key: string) {
      const next = PRESETS.find((candidate) => candidate.key === key) ?? PRESETS[0];
      setPreset(next);
      setWidth(next.width);
      setHeight(null);
    }

    /** @summary Intercambia ancho y alto para simular la orientación opuesta (retrato ↔ paisaje). */
    function rotate() {
      if (width == null) return;
      const currentHeight = height ?? frameSize?.height ?? preset.height ?? 800;
      setHeight(width);
      setWidth(currentHeight);
    }

    function startResize(axis: "width" | "height") {
      return (event: React.PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startY = event.clientY;
        const startWidth = width ?? frameRef.current?.clientWidth ?? 0;
        const startHeight = height ?? frameRef.current?.clientHeight ?? 0;
        const move = (moveEvent: PointerEvent) => {
          if (axis === "width") {
            setWidth(Math.round(clamp(startWidth + moveEvent.clientX - startX, MIN_WIDTH, MAX_WIDTH)));
          } else {
            setHeight(Math.round(clamp(startHeight + moveEvent.clientY - startY, MIN_HEIGHT, MAX_HEIGHT)));
          }
          setResizing(axis);
        };
        const up = () => {
          setResizing(null);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
    }

    const label = `${width ?? frameSize?.width ?? "…"} × ${height ?? frameSize?.height ?? "…"}`;
    const frameStyle: CSSProperties = {
      width: width ?? undefined,
      height: height ?? undefined,
    };

    return (
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0f]">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Tamaños de vista previa">
            {PRESETS.map((candidate) => {
              const active = preset.key === candidate.key;
              return (
                <button
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
                    active ? "bg-pink-500/20 text-pink-200 ring-1 ring-pink-500/40" : "text-zinc-500 hover:bg-white/5"
                  }`}
                  key={candidate.key}
                  onClick={() => selectPreset(candidate.key)}
                  type="button"
                >
                  {candidate.label}
                </button>
              );
            })}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="min-w-24 rounded-full bg-white/5 px-3 py-1 text-center text-[11px] font-black tabular-nums text-zinc-300">
              {label}
            </span>
            <button
              className={`grid h-8 w-8 place-items-center rounded-full border text-sm transition ${
                width == null
                  ? "cursor-not-allowed border-white/10 text-zinc-700"
                  : "border-white/15 bg-white/5 text-zinc-300 hover:bg-white/10"
              }`}
              disabled={width == null}
              onClick={rotate}
              type="button"
              title="Rotar vista previa"
              aria-label="Rotar vista previa"
            >
              ⟳
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 justify-center overflow-hidden p-4">
          <div
            ref={frameRef}
            className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/60"
            style={frameStyle}
          >
            <iframe
              ref={iframeRef}
              className="block h-full w-full bg-transparent"
              src="about:blank"
              title="Vista previa"
              onLoad={prepareDocument}
            />
            {frameDoc &&
              createPortal(
                <div
                  className="min-h-full"
                  style={{ background: "inherit" }}
                  onClick={(event) => {
                    const anchor = (event.target as HTMLElement).closest("a");
                    if (anchor) event.preventDefault();
                  }}
                >
                  {children}
                </div>,
                frameDoc.body,
              )}

            <button
              className="absolute right-0 top-1/2 z-10 h-16 w-3 -translate-y-1/2 cursor-ew-resize rounded-l-lg border border-white/15 bg-white/10 hover:bg-pink-500/40"
              onPointerDown={startResize("width")}
              type="button"
              aria-label="Cambiar ancho"
            />
            <button
              className="absolute bottom-0 left-1/2 z-10 h-3 w-16 -translate-x-1/2 cursor-ns-resize rounded-t-lg border border-white/15 bg-white/10 hover:bg-pink-500/40"
              onPointerDown={startResize("height")}
              type="button"
              aria-label="Cambiar alto"
            />

            {resizing && (
              <span className="pointer-events-none absolute left-1/2 top-2 z-20 -translate-x-1/2 rounded-full bg-black/90 px-3 py-1 text-[11px] font-black tabular-nums text-white shadow-lg">
                {label}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  },
);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}