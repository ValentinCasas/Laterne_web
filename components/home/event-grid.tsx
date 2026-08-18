"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Icon } from "@/components/admin/ui/icons";

export type PublicEvent = {
  id: number;
  name: string;
  description: string;
  location: string;
  date: string | null;
  time: string;
  imageUrl: string | null;
};

/** @summary Muestra la agenda de eventos y permite ampliar las imágenes disponibles. */
export function EventGrid({ events }: { events: PublicEvent[] }) {
  const [selected, setSelected] = useState<PublicEvent | null>(null);
  useEffect(() => {
    /** @summary Cierra la vista ampliada cuando el visitante presiona la tecla Escape. */
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  return (
    <>
      <div className="event-scroll mt-9 grid max-h-[720px] gap-5 overflow-y-auto pr-2 lg:grid-cols-2">
        {events.length ? (
          events.map((event) => (
            <article className="group card grid overflow-hidden sm:grid-cols-[180px_1fr]" key={event.id}>
              <button
                className="relative min-h-48 overflow-hidden bg-zinc-900"
                type="button"
                onClick={() => event.imageUrl && setSelected(event)}
                aria-label={`Ampliar imagen de ${event.name}`}
                disabled={!event.imageUrl}
              >
                {event.imageUrl ? (
                  <Image
                    src={`/images/images_event/${event.imageUrl}`}
                    alt={event.name}
                    fill
                    sizes="180px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <span className="grid h-full place-items-center text-zinc-700"><Icon name="music" className="h-10 w-10" /></span>
                )}
              </button>
              <div className="p-6">
                <p className="text-sm font-bold text-pink-400">
                  {event.date
                    ? new Date(event.date).toLocaleDateString("es-AR", { timeZone: "UTC" })
                    : "Fecha a confirmar"}{" "}
                  · {event.time}
                </p>
                <h3 className="mt-2 text-2xl font-black">{event.name}</h3>
                <p className="mt-2 line-clamp-3 text-zinc-400">{event.description}</p>
                <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold"><Icon name="map-pin" className="h-4 w-4 text-pink-400" /> {event.location}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="card col-span-full p-10 text-center text-zinc-400">
            Próximamente anunciaremos nuevos eventos.
          </div>
        )}
      </div>
      {selected?.imageUrl && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-5"
          role="dialog"
          aria-modal="true"
          aria-label={`Imagen de ${selected.name}`}
          onClick={() => setSelected(null)}
        >
          <div className="relative h-[80vh] w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={`/images/images_event/${selected.imageUrl}`}
              alt={selected.name}
              fill
              className="rounded-3xl object-contain"
            />
            <button
              className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-white text-2xl text-black"
              onClick={() => setSelected(null)}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}
