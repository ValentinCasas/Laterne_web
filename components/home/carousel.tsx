"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useDragToScroll } from "@/components/use-carousel-drag";

type Slide = {
  image?: string;
  imageAlt?: string;
  eyebrow?: string;
  title?: string;
  text?: string;
  quote?: string;
  meta?: string;
};

/** @summary Muestra contenido destacado en un carrusel desplazable, automático y accesible. */
export function Carousel({
  slides,
  label,
  interval = 4500,
  variant = "feature",
}: {
  slides: Slide[];
  label: string;
  interval?: number;
  variant?: "feature" | "beer" | "testimonial";
}) {
  const { ref: viewport, isDragging, dragProps } = useDragToScroll<HTMLDivElement>();
  const [active, setActive] = useState(0);

  /** @summary Desplaza el carrusel hasta la diapositiva indicada sin mover la página completa. */
  const show = useCallback(
    (index: number) => {
      if (!slides.length) return;
      const next = (index + slides.length) % slides.length;
      const container = viewport.current;
      const target = container?.children[next] as HTMLElement | undefined;
      setActive(next);
      if (!container || !target) return;
      const left =
        target.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
      container.scrollTo({ left, behavior: "smooth" });
    },
    [slides.length, viewport],
  );

  useEffect(() => {
    if (isDragging || slides.length < 2) return;
    const timer = window.setInterval(() => show(active + 1), interval);
    return () => window.clearInterval(timer);
  }, [active, interval, isDragging, show, slides.length]);

  /** @summary Sincroniza los indicadores después de mover el carrusel con mouse o pantalla táctil. */
  function syncActiveSlide() {
    const container = viewport.current;
    if (!container) return;
    const containerLeft = container.getBoundingClientRect().left;
    const next = [...container.children].reduce(
      (closest, child, index) => {
        const distance = Math.abs((child as HTMLElement).getBoundingClientRect().left - containerLeft);
        return distance < closest.distance ? { index, distance } : closest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    );
    setActive(next.index);
  }

  if (!slides.length) return null;

  return (
    <div
      className={`carousel carousel-${variant}`}
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
    >
      <div
        ref={viewport}
        {...dragProps}
        onScroll={syncActiveSlide}
        className={`flex overflow-x-auto select-none [scrollbar-width:none] ${
          isDragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory scroll-smooth"
        }`}
      >
        {slides.map((slide, index) => (
          <article
            className={`relative snap-start overflow-hidden rounded-[2rem] ${
              variant === "testimonial"
                ? "card min-h-64 min-w-full p-7 md:min-w-[calc(100%/3)]"
                : "min-w-full"
            }`}
            key={`${slide.title ?? slide.meta ?? "slide"}-${index}`}
          >
            {slide.image && (
              <div
                className={
                  variant === "beer" ? "relative mx-auto h-[430px] max-w-5xl" : "relative min-h-[520px]"
                }
              >
                <Image
                  src={slide.image}
                  alt={slide.imageAlt ?? ""}
                  fill
                  sizes="(max-width: 768px) 100vw, 1100px"
                  className={`pointer-events-none ${variant === "beer" ? "object-contain" : "object-cover"}`}
                  draggable={false}
                  priority={index === 0}
                />
              </div>
            )}
            {variant === "feature" && (
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black via-black/20 to-transparent p-8 sm:p-12">
                <div className="max-w-2xl">
                  <p className="font-bold uppercase tracking-[.25em] text-pink-400">{slide.eyebrow}</p>
                  <h3 className="mt-2 text-4xl font-black sm:text-6xl">{slide.title}</h3>
                  <p className="mt-4 text-lg text-zinc-200">{slide.text}</p>
                </div>
              </div>
            )}
            {variant === "testimonial" && (
              <>
                <span className="text-4xl text-pink-400">“</span>
                <blockquote className="mt-3 text-lg leading-relaxed">{slide.quote}</blockquote>
                <p className="mt-6 text-sm text-zinc-500">{slide.meta}</p>
              </>
            )}
          </article>
        ))}
      </div>

      {slides.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            className="carousel-arrow"
            type="button"
            onClick={() => show(active - 1)}
            aria-label="Anterior"
          >
            ←
          </button>
          <div className="flex gap-2">
            {slides.map((_slide, index) => (
              <button
                className={`h-2 rounded-full transition-all ${index === active ? "w-8 bg-pink-500" : "w-2 bg-zinc-600"}`}
                onClick={() => show(index)}
                aria-label={`Ir a la diapositiva ${index + 1}`}
                aria-current={index === active}
                key={index}
              />
            ))}
          </div>
          <button
            className="carousel-arrow"
            type="button"
            onClick={() => show(active + 1)}
            aria-label="Siguiente"
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
