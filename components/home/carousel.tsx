"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSwipeCarousel } from "@/components/use-carousel-drag";

type Slide = {
  image?: string;
  imageAlt?: string;
  eyebrow?: string;
  title?: string;
  text?: string;
  quote?: string;
  meta?: string;
};

/** @summary Muestra contenido destacado en un carrusel automático con controles y gestos laterales. */
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
  const [active, setActive] = useState(0);
  const move = useCallback(
    (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length),
    [slides.length],
  );
  const { offset, isDragging, swipeProps } = useSwipeCarousel(
    () => move(-1),
    () => move(1),
  );
  useEffect(() => {
    if (isDragging || slides.length < 2) return;
    const timer = window.setInterval(() => move(1), interval);
    return () => window.clearInterval(timer);
  }, [interval, isDragging, move, slides.length]);
  if (!slides.length) return null;
  const visible =
    variant === "testimonial"
      ? [0, 1, 2].map((offset) => slides[(active + offset) % slides.length])
      : [slides[active]];
  return (
    <div
      className={`carousel carousel-${variant}`}
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
    >
      <div
        {...swipeProps}
        className={`overflow-hidden select-none touch-pan-y ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div
          className={variant === "testimonial" ? "grid gap-5 md:grid-cols-3" : "relative"}
          aria-live="polite"
          style={{
            transform: `translate3d(${offset}px, 0, 0)`,
            transition: isDragging ? "none" : "transform 180ms ease-out",
          }}
        >
          {visible.map((slide, index) => (
            <article
              className={
                variant === "testimonial" ? "card min-h-64 p-7" : "relative overflow-hidden rounded-[2rem]"
              }
              key={`${active}-${index}`}
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
                    priority={active === 0}
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
      </div>
      {slides.length > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button className="carousel-arrow" type="button" onClick={() => move(-1)} aria-label="Anterior">
            ←
          </button>
          <div className="flex gap-2">
            {slides.map((_slide, index) => (
              <button
                className={`h-2 rounded-full transition-all ${index === active ? "w-8 bg-pink-500" : "w-2 bg-zinc-600"}`}
                onClick={() => setActive(index)}
                aria-label={`Ir a la diapositiva ${index + 1}`}
                aria-current={index === active}
                key={index}
              />
            ))}
          </div>
          <button className="carousel-arrow" type="button" onClick={() => move(1)} aria-label="Siguiente">
            →
          </button>
        </div>
      )}
    </div>
  );
}
