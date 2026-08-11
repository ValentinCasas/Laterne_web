import Link from "next/link";
import { MarketingShell } from "@/components/commercial/marketing-shell";
import { ProductMockup } from "@/components/commercial/product-mockup";
import { StickyStorySection } from "@/components/commercial/sticky-story-section";

export const metadata = { title: "Multi-sucursal | MenuClick", description: "Una operación conectada para negocios gastronómicos con una o múltiples sucursales." };

export default function MultiBranchPage() {
  const steps = [
    { eyebrow: "01 · Control central", title: "Una mirada para toda la empresa.", description: "El propietario puede revisar la actividad de todos los locales sin perder la posibilidad de entrar en el detalle de cada uno.", visual: <ProductMockup mode="branches" /> },
    { eyebrow: "02 · Usuarios", title: "Cada encargado ve lo que corresponde.", description: "Los usuarios pertenecen al tenant y reciben acceso a todas, una o varias sucursales según su trabajo.", visual: <ProductMockup mode="dashboard" /> },
    { eyebrow: "03 · Stock", title: "Inventario independiente por local.", description: "Cada sucursal tiene sus existencias, mínimos, movimientos y alertas sin mezclar el stock de otra.", visual: <ProductMockup mode="stock" /> },
    { eyebrow: "04 · Operación", title: "Pedidos y mesas donde ocurren.", description: "Los pedidos, mesas y operaciones se pueden consultar respetando la sucursal autorizada.", visual: <ProductMockup mode="orders" /> },
    { eyebrow: "05 · Comparación", title: "Consolidá sin perder contexto.", description: "Las estadísticas permiten entender el negocio general y detectar diferencias entre locales.", visual: <ProductMockup mode="analytics" /> },
    { eyebrow: "06 · Expansión", title: "Abrir otro local no significa empezar de cero.", description: "Creá la sucursal, asigná accesos y continuá usando la misma base operativa y visual.", visual: <ProductMockup mode="branches" /> },
  ];
  return <MarketingShell><main><section className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-24 sm:py-36 lg:grid-cols-2"><div><p className="marketing-eyebrow">Para grupos y negocios en expansión</p><h1 className="mt-4 text-5xl font-black tracking-tight sm:text-7xl">Una sucursal o veinte. El control sigue siendo uno.</h1><p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-400">MenuClick organiza usuarios, stock y operación por local mientras mantiene una identidad y una visión central.</p><Link className="mt-9 inline-flex rounded-xl bg-[#e8ff6a] px-5 py-3 font-black text-[#0b0d12]" href="/solicitar-demo">Hablar sobre mi operación</Link></div><ProductMockup mode="branches" /></section><StickyStorySection eyebrow="Arquitectura para crecer" title="La estructura acompaña al negocio." intro="Sucursal A no tiene por qué compartir operaciones con Sucursal B. Pero el dueño sí puede entender ambas." steps={steps} reverse /><section className="mx-auto max-w-[1280px] px-5 pb-28"><div className="rounded-[2rem] border border-[#e8ff6a]/25 bg-[#e8ff6a]/10 p-8 sm:p-12"><p className="marketing-eyebrow">Siguiente local</p><h2 className="mt-3 max-w-3xl text-4xl font-black">Crecer debería ser configurar, no reconstruir.</h2><Link className="mt-8 inline-flex rounded-xl bg-[#e8ff6a] px-5 py-3 font-black text-[#0b0d12]" href="/solicitar-demo">Solicitar demo</Link></div></section></main></MarketingShell>;
}
