import Link from "next/link";

/** @summary Orienta al visitante cuando una dirección o contenido ya no se encuentra disponible. */
export default function NotFoundPage() {
  return (
    <main className="shell grid min-h-[72vh] place-items-center py-12">
      <section className="max-w-2xl text-center">
        <p className="text-8xl font-black text-pink-500">404</p>
        <h1 className="mt-3 text-4xl font-black">Esta mesa quedó vacía.</h1>
        <p className="mt-4 text-zinc-400">
          La página no existe, cambió de dirección o dejó de estar publicada.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link className="btn" href="/carta">
            Ir a la carta
          </Link>
          <Link className="btn btn-secondary" href="/">
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
