/** @summary Presenta un estado de mantenimiento claro para interrupciones planificadas. */
export default function MaintenancePage() {
  return (
    <main className="shell grid min-h-[72vh] place-items-center py-12">
      <section className="card max-w-xl p-8 text-center">
        <p className="section-eyebrow">Mantenimiento programado</p>
        <h1 className="mt-3 text-4xl font-black">Estamos preparando la próxima ronda.</h1>
        <p className="mt-4 text-zinc-400">
          El servicio volverá a estar disponible en breve. No necesitás realizar ninguna acción.
        </p>
      </section>
    </main>
  );
}
