"use client";

import { useState } from "react";

/** @summary Muestra el formulario público para enviar una opinión anónima sobre Laterne. */
export function TestimonialForm() {
  const [message, setMessage] = useState("");
  /** @summary Envía la opinión al servidor y comunica el resultado al visitante. */
  async function submit(formData: FormData) {
    const description = String(formData.get("description") ?? "");
    const response = await fetch("/api/testimonials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description }),
    });
    setMessage(
      response.ok
        ? "¡Gracias! Tu comentario quedó pendiente de revisión."
        : "No pudimos guardar tu comentario.",
    );
  }
  return (
    <form action={submit} className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
      <label className="sr-only" htmlFor="testimonial">
        Tu opinión
      </label>
      <input
        id="testimonial"
        className="input"
        name="description"
        maxLength={500}
        required
        placeholder="Dejanos una opinión anónima"
      />
      <button className="btn sm:min-w-36" type="submit">
        Enviar
      </button>
      {message && (
        <p className="text-center text-sm text-pink-300 sm:col-span-2" role="status">
          {message}
        </p>
      )}
    </form>
  );
}
