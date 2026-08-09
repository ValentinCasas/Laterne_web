import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
/** @summary Muestra los accesos principales disponibles en el panel de administración. */
export default async function Dashboard() {
  const values = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.event.count(),
    prisma.testimonial.count(),
    prisma.user.count(),
  ]);
  const labels = ["Productos", "Categorías", "Eventos", "Opiniones", "Usuarios"];
  return (
    <section>
      <p className="font-bold uppercase tracking-widest text-pink-400">Panel</p>
      <h1 className="mt-2 text-4xl font-black">Resumen del negocio</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {values.map((value, index) => (
          <article className="card p-5" key={labels[index]}>
            <p className="text-sm text-zinc-400">{labels[index]}</p>
            <strong className="mt-2 block text-3xl">{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
