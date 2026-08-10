import { ReservationForm } from "@/components/reservations/reservation-form";
import { prisma } from "@/lib/prisma";
import { managedPageMetadata } from "@/lib/seo";
import { getDefaultTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/** @summary Recupera la configuración SEO administrable de reservas. */
export function generateMetadata() {
  return managedPageMetadata("/reservas", "Reservas", "Consultá disponibilidad y solicitá una mesa.");
}

/** @summary Presenta la disponibilidad del negocio y el formulario público de reservas. */
export default async function ReservationsPage() {
  const tenant = await getDefaultTenant();
  const settings = await prisma.reservationSettings.findUnique({ where: { tenantId: tenant.id } });
  const sectors = Array.isArray(settings?.sectors)
    ? settings.sectors.filter((sector): sector is string => typeof sector === "string")
    : ["Salón", "Exterior"];
  const minimumDate = new Date().toISOString().slice(0, 10);

  return (
    <main className="shell py-10 sm:py-16">
      <section className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-start">
        <div className="lg:sticky lg:top-24">
          <p className="section-eyebrow">Tu próxima visita</p>
          <h1 className="mt-3 text-5xl font-black tracking-[-.06em] sm:text-7xl">
            Reservá sin llamadas ni esperas.
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            Elegí una franja con capacidad disponible. Cada solicitud recibe una referencia y queda registrada
            para su confirmación.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {["Disponibilidad real", "Confirmación clara", "Datos protegidos"].map((benefit) => (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4 font-bold" key={benefit}>
                <span className="mr-2 text-pink-400">✓</span>
                {benefit}
              </div>
            ))}
          </div>
        </div>
        {settings?.enabled === false ? (
          <div className="rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-10">
            <h2 className="text-3xl font-black text-amber-200">Reservas online pausadas</h2>
            <p className="mt-3 text-amber-100/70">
              Contactá al negocio por teléfono o WhatsApp para consultar.
            </p>
          </div>
        ) : (
          <ReservationForm
            minimumDate={minimumDate}
            initialSectors={sectors}
            initialPolicy={settings?.policy ?? "La reserva queda sujeta a confirmación del negocio."}
            initialMaximumPartySize={settings?.maximumPartySize ?? 20}
          />
        )}
      </section>
    </main>
  );
}
