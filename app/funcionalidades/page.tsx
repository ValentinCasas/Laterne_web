import Link from "next/link";
import { MarketingShell } from "@/components/commercial/marketing-shell";
import { ProductMockup } from "@/components/commercial/product-mockup";
import { StickyStorySection } from "@/components/commercial/sticky-story-section";

export const metadata = {
  title: "Funcionalidades | MenuClick",
  description: "Las herramientas reales de MenuClick para operar un negocio gastronómico.",
};

const groups = [
  [
    "Carta y contenido",
    "Productos, categorías, precios, disponibilidad, promociones, eventos, horarios, testimonios y modelos 3D.",
    "menu",
  ],
  [
    "Operación",
    "Pedidos por estados, reservas, mesas QR, comprobantes internos, stock por sucursal y movimientos auditables.",
    "orders",
  ],
  [
    "Clientes",
    "Clientes frecuentes, puntos, niveles e historial para sostener relaciones más allá del pedido.",
    "customers",
  ],
  [
    "Marca",
    "Landing, carta pública, dominio, SEO, redes, recursos visuales y paleta global por tenant.",
    "dashboard",
  ],
  [
    "Análisis",
    "Recorridos públicos, productos consultados, pedidos, reservas, dispositivos y exportación.",
    "analytics",
  ],
  [
    "Herramientas",
    "Importación, exportación, biblioteca de medios, ayuda, soporte, auditoría y sesiones revocables.",
    "stock",
  ],
] as const;

/**
 * @summary Renderiza la página comercial de funcionalidades de MenuClick.
 */
export default function FeaturesPage() {
  const steps = groups.map(([name, description, mode]) => ({
    eyebrow: name,
    title: description.split(".")[0],
    description,
    visual: <ProductMockup mode={mode} />,
  }));
  return (
    <MarketingShell>
      <main>
        <section className="mx-auto max-w-[1280px] px-5 py-24 sm:py-36">
          <p className="marketing-eyebrow">El producto por dentro</p>
          <h1 className="mt-4 max-w-5xl text-5xl font-black tracking-tight sm:text-8xl">
            Todo lo que necesitás para que el negocio siga avanzando.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-400">
            MenuClick agrupa la complejidad en recorridos simples: una carta que vende, una operación que
            responde y datos que ayudan a decidir.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              className="rounded-xl bg-[#e8ff6a] px-5 py-3 font-black text-[#0b0d12]"
              href="/solicitar-demo"
            >
              Verlo en una demo
            </Link>
            <Link className="rounded-xl border border-white/15 px-5 py-3 font-bold" href="/planes">
              Ver planes
            </Link>
          </div>
        </section>
        <StickyStorySection
          eyebrow="Módulos que trabajan juntos"
          title="No son 50 funciones sueltas."
          intro="Son las piezas que el equipo necesita para pasar de una visita a una operación más clara."
          steps={steps}
        />
        <section className="mx-auto max-w-[1280px] px-5 pb-28">
          <div className="rounded-3xl border border-white/10 bg-white/[.035] p-7 sm:p-10">
            <h2 className="text-3xl font-black">Una base que puede crecer</h2>
            <p className="mt-3 max-w-2xl text-slate-400">
              Empezá con lo que hoy necesitás y sumá sucursales, usuarios, stock, reservas o experiencias 3D
              cuando el negocio lo pida.
            </p>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
