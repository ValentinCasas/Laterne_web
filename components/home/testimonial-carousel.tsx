"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSwipeCarousel } from "@/components/use-carousel-drag";

type Testimonial = { id: number; description: string; date: string; avatar: string };

/** @summary Presenta opiniones aprobadas con avatares y navegación automática o manual. */
export function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const [active, setActive] = useState(0);
  const move = useCallback(
    (amount: number) =>
      setActive((current) => (current + amount + testimonials.length) % testimonials.length),
    [testimonials.length],
  );
  const { offset, isDragging, swipeProps } = useSwipeCarousel(
    () => move(-1),
    () => move(1),
  );
  useEffect(() => {
    if (isDragging || testimonials.length < 2) return;
    const timer = window.setInterval(() => move(1), 5200);
    return () => window.clearInterval(timer);
  }, [isDragging, move, testimonials.length]);
  if (!testimonials.length)
    return <p className="mt-8 text-center text-zinc-500">Todavía no hay opiniones aprobadas.</p>;
  const visible = [0, 1, 2]
    .slice(0, Math.min(3, testimonials.length))
    .map((offset) => testimonials[(active + offset) % testimonials.length]);
  return (
    <div role="region" aria-label="Opiniones de clientes" aria-roledescription="carrusel">
      <div
        {...swipeProps}
        className={`overflow-hidden px-1 pt-12 select-none touch-pan-y ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <div
          className="flex gap-5"
          style={{
            transform: `translate3d(${offset}px, 0, 0)`,
            transition: isDragging ? "none" : "transform 180ms ease-out",
          }}
        >
          {visible.map((item) => (
            <article
              className="relative min-h-64 min-w-full rounded-3xl border border-pink-500/35 bg-gradient-to-b from-pink-950/55 to-zinc-950 p-7 pt-16 text-center shadow-2xl shadow-black/30 md:min-w-[calc((100%_-_2.5rem)/3)]"
              key={`${active}-${item.id}`}
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
      </div>
      {testimonials.length > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <button className="carousel-arrow" onClick={() => move(-1)} aria-label="Opinión anterior">
            ←
          </button>
          <div className="flex gap-2">
            {testimonials.map((_item, index) => (
              <button
                className={`h-2 rounded-full ${index === active ? "w-8 bg-pink-500" : "w-2 bg-zinc-600"}`}
                onClick={() => setActive(index)}
                aria-label={`Mostrar opinión ${index + 1}`}
                key={index}
              />
            ))}
          </div>
          <button className="carousel-arrow" onClick={() => move(1)} aria-label="Opinión siguiente">
            →
          </button>
        </div>
      )}
    </div>
  );
}
