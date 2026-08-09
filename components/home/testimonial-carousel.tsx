"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useDragToScroll } from "@/components/use-carousel-drag";

type Testimonial = { id: number; description: string; date: string; avatar: string };

/** @summary Presenta opiniones aprobadas en un carrusel suave con navegación automática o manual. */
export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const { ref: viewport, isDragging, dragProps } = useDragToScroll<HTMLDivElement>();
  const [active, setActive] = useState(0);

  /** @summary Desplaza la colección hasta la opinión seleccionada. */
  const show = useCallback(
    (index: number) => {
      if (!testimonials.length) return;
      const next = (index + testimonials.length) % testimonials.length;
      const container = viewport.current;
      const target = container?.children[next] as HTMLElement | undefined;
      setActive(next);
      if (!container || !target) return;
      const left =
        target.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
      container.scrollTo({ left, behavior: "smooth" });
    },
    [testimonials.length, viewport],
  );

  useEffect(() => {
    if (isDragging || testimonials.length < 2) return;
    const timer = window.setInterval(() => show(active + 1), 5200);
    return () => window.clearInterval(timer);
  }, [active, isDragging, show, testimonials.length]);

  /** @summary Actualiza el indicador al terminar un desplazamiento manual. */
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

  if (!testimonials.length) {
    return <p className="mt-8 text-center text-zinc-500">Todavía no hay opiniones aprobadas.</p>;
  }

  return (
    <div role="region" aria-label="Opiniones de clientes" aria-roledescription="carrusel">
      <div
        ref={viewport}
        {...dragProps}
        onScroll={syncActiveSlide}
        className={`flex gap-5 overflow-x-auto px-1 pt-12 pb-2 select-none [scrollbar-width:none] ${
          isDragging ? "cursor-grabbing snap-none" : "cursor-grab snap-x snap-mandatory scroll-smooth"
        }`}
      >
        {testimonials.map((item) => (
          <article
            className="relative min-h-64 min-w-full snap-start rounded-3xl border border-pink-500/35 bg-gradient-to-b from-pink-950/55 to-zinc-950 p-7 pt-16 text-center shadow-2xl shadow-black/30 md:min-w-[calc((100%_-_2.5rem)/3)]"
            key={item.id}
          >
            <figure className="absolute -top-11 left-1/2 h-24 w-24 -translate-x-1/2 rounded-full bg-gradient-to-br from-pink-500 to-orange-400 p-1">
              <Image
                src={`/images/avatars_defect/${item.avatar}`}
                alt="Cliente de Laterne"
                fill
                sizes="96px"
                className="pointer-events-none rounded-full border-4 border-zinc-950 object-cover p-1"
                draggable={false}
              />
            </figure>
            <time className="text-sm font-bold text-pink-400">{item.date}</time>
            <blockquote className="mt-5 text-lg leading-relaxed text-zinc-100">
              <span aria-hidden="true">“</span>
              {item.description}
              <span aria-hidden="true">”</span>
            </blockquote>
          </article>
        ))}
      </div>

      {testimonials.length > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button className="carousel-arrow" onClick={() => show(active - 1)} aria-label="Opinión anterior">
            ←
          </button>
          <div className="flex max-w-52 gap-2 overflow-hidden">
            {testimonials.map((_item, index) => (
              <button
                className={`h-2 shrink-0 rounded-full transition-all ${index === active ? "w-8 bg-pink-500" : "w-2 bg-zinc-600"}`}
                onClick={() => show(index)}
                aria-label={`Mostrar opinión ${index + 1}`}
                key={index}
              />
            ))}
          </div>
          <button className="carousel-arrow" onClick={() => show(active + 1)} aria-label="Opinión siguiente">
            →
          </button>
        </div>
      )}
    </div>
  );
}
