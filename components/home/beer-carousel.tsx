"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useDragToScroll } from "@/components/use-carousel-drag";

/** @summary Presenta las cervezas en un carrusel automático que también admite navegación manual. */
export function BeerCarousel({ images }: { images: string[] }) {
  const { ref: viewport, isDragging, dragProps } = useDragToScroll<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const show = useCallback(
    (index: number) => {
      const next = (index + images.length) % images.length;
      const container = viewport.current;
      const target = container?.children[next] as HTMLElement | undefined;

      setActive(next);
      if (container && target) {
        const targetLeft =
          target.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
        container.scrollTo({ left: targetLeft, behavior: "smooth" });
      }
    },
    [images.length, viewport],
  );
  useEffect(() => {
    if (isDragging || images.length < 2) return;
    const timer = window.setInterval(() => show(active + 1), 4200);
    return () => window.clearInterval(timer);
  }, [active, images.length, isDragging, show]);

  /** @summary Detecta qué cerveza está más cerca del inicio luego de un desplazamiento manual. */
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

  return (
    <div role="region" aria-label="Cervezas Laterne" aria-roledescription="carrusel">
      <div
        ref={viewport}
        {...dragProps}
        onScroll={syncActiveSlide}
        className={`flex gap-5 overflow-x-auto px-[8vw] py-8 select-none [scrollbar-width:none] sm:px-0 ${isDragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory scroll-smooth"}`}
      >
        {images.map((image, index) => (
          <article
            className="relative h-[420px] min-w-[84vw] snap-start overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 sm:min-w-[calc((100%_-_2.5rem)/3)]"
            key={image}
          >
            <Image
              src={image}
              alt={`Cerveza artesanal Laterne ${index + 1}`}
              fill
              sizes="(max-width: 640px) 84vw, 33vw"
              className="pointer-events-none object-contain p-4"
              draggable={false}
            />
          </article>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button className="carousel-arrow" onClick={() => show(active - 1)} aria-label="Cerveza anterior">
          ←
        </button>
        <div className="flex gap-2">
          {images.map((_image, index) => (
            <button
              className={`h-2 rounded-full ${index === active ? "w-8 bg-pink-500" : "w-2 bg-zinc-600"}`}
              onClick={() => show(index)}
              aria-label={`Mostrar cerveza ${index + 1}`}
              key={index}
            />
          ))}
        </div>
        <button className="carousel-arrow" onClick={() => show(active + 1)} aria-label="Cerveza siguiente">
          →
        </button>
      </div>
    </div>
  );
}
