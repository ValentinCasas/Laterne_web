import Link from "next/link";

/** @summary Explica el estado sin conexión y permite reintentar o volver a la carta guardada. */
export default function OfflinePage() {
  return (
    <main className="shell grid min-h-[70vh] place-items-center py-12">
      <section className="card max-w-xl p-8 text-center">
        <span className="text-5xl">↯</span>
        <p className="section-eyebrow mt-5">Sin conexión</p>
        <h1 className="mt-2 text-4xl font-black">La red se tomó una pausa.</h1>
        <p className="mt-4 text-zinc-400">
          Podés intentar volver a la carta disponible en este dispositivo o reintentar cuando regrese
          internet.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link className="btn" href="/carta">
            Abrir carta
          </Link>
          <Link className="btn btn-secondary" href="/">
            Reintentar
          </Link>
        </div>
      </section>
    </main>
  );
}
