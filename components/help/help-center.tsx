"use client";

import { useMemo, useState } from "react";

export type HelpArticleData = {
  id: number;
  title: string;
  summary: string;
  content: string;
  category: string;
};

/** @summary Permite buscar respuestas y enviar una consulta cuando la documentación no alcanza. */
export function HelpCenter({ articles, whatsapp }: { articles: HelpArticleData[]; whatsapp: string }) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return normalized
      ? articles.filter((article) =>
          `${article.title} ${article.summary} ${article.content} ${article.category}`
            .toLocaleLowerCase("es")
            .includes(normalized),
        )
      : articles;
  }, [articles, query]);

  /** @summary Envía una consulta de soporte y comunica su referencia al visitante. */
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const result = (await response.json().catch(() => ({}))) as { reference?: string; error?: string };
    if (!response.ok || !result.reference) {
      setMessage(result.error ?? "No se pudo enviar la consulta");
      return;
    }
    setMessage(`Consulta recibida. Tu referencia es ${result.reference}.`);
    event.currentTarget.reset();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section>
        <label>
          <span className="sr-only">Buscar en ayuda</span>
          <input
            className="input mb-5"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Buscar una respuesta…"
          />
        </label>
        <div className="space-y-3">
          {filtered.map((article) => (
            <details className="card group p-5" key={article.id}>
              <summary className="cursor-pointer list-none font-black">
                <span className="mr-3 text-pink-300">{article.category}</span>
                {article.title}
              </summary>
              <p className="mt-3 text-sm text-zinc-400">{article.summary}</p>
              <div className="mt-4 whitespace-pre-wrap border-t border-white/10 pt-4 leading-relaxed text-zinc-300">
                {article.content}
              </div>
            </details>
          ))}
          {!filtered.length && (
            <p className="card p-8 text-center text-zinc-500">No encontramos una guía con esas palabras.</p>
          )}
        </div>
      </section>
      <aside className="card h-fit p-5 sm:p-7">
        <h2 className="text-2xl font-black">¿Necesitás ayuda?</h2>
        <p className="mt-2 text-sm text-zinc-500">Contanos qué pasó y vas a recibir una referencia.</p>
        <form className="mt-5 space-y-3" onSubmit={submit}>
          <input className="input" name="customerName" required placeholder="Nombre" />
          <input className="input" name="email" type="email" required placeholder="Email" />
          <input className="input" name="phone" placeholder="Teléfono opcional" />
          <select className="input" name="category">
            <option>Pedido</option>
            <option>Reserva</option>
            <option>Carta</option>
            <option>Privacidad</option>
            <option>Otro</option>
          </select>
          <input className="input" name="subject" required placeholder="Asunto" />
          <textarea
            className="input min-h-28"
            name="message"
            required
            minLength={10}
            placeholder="Explicanos el problema"
          />
          <input className="hidden" name="website" tabIndex={-1} autoComplete="off" />
          <button className="btn w-full">Enviar consulta</button>
        </form>
        {message && (
          <p className="mt-4 text-sm text-pink-300" role="status">
            {message}
          </p>
        )}
        {whatsapp && (
          <a
            className="btn btn-secondary mt-3 w-full"
            href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noreferrer"
          >
            Hablar por WhatsApp
          </a>
        )}
      </aside>
    </div>
  );
}
