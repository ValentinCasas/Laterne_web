import Link from "next/link";

/** @summary Ofrece caminos de recuperación cuando una página o producto no existe. */
export default function NotFoundPage() {
  return (
    <main className="shell grid min-h-[calc(100vh-4rem)] place-items-center py-16 text-center">
      <div>
        <p className="text-8xl font-black text-pink-500">404</p>
        <h1 className="mt-4 text-4xl font-black">No encontramos esta página.</h1>
        <p className="mx-auto mt-3 max-w-lg text-zinc-500">
          Es posible que el contenido haya cambiado de dirección o todavía no esté publicado.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link className="btn" href="/">
            Ir al inicio
          </Link>
          <Link className="btn btn-secondary" href="/carta">
            Abrir la carta
          </Link>
        </div>
      </div>
    </main>
  );
}
