import Link from "next/link";

/** @summary Informa que la sesión actual no posee autorización para abrir una sección. */
export default function ForbiddenPage() {
  return (
    <main className="shell grid min-h-[72vh] place-items-center py-12">
      <section className="card max-w-xl p-8 text-center">
        <p className="section-eyebrow">Acceso restringido</p>
        <h1 className="mt-3 text-4xl font-black">No tenés permiso para entrar.</h1>
        <p className="mt-4 text-zinc-400">
          Si necesitás esta función, pedile al propietario que revise tu rol.
        </p>
        <Link className="btn mt-6" href="/">
          Volver a MenuClick
        </Link>
      </section>
    </main>
  );
}
