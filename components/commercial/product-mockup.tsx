type MockupMode = "dashboard" | "menu" | "orders" | "stock" | "branches" | "customers" | "analytics";
type AccentToken = "primary" | "secondary" | "accent" | "success" | "warning";

const mockupContent: Record<
  MockupMode,
  { label: string; title: string; rows: string[]; accent: AccentToken }
> = {
  dashboard: {
    label: "Resumen",
    title: "Tu operación hoy",
    rows: ["Pedidos en curso          24", "Reservas pendientes       08", "Stock bajo                 03"],
    accent: "primary",
  },
  menu: {
    label: "Carta",
    title: "Productos publicados",
    rows: [
      "Hamburguesa clásica       $ 8.500",
      "Papas con cheddar          $ 4.200",
      "Cerveza IPA 473 ml        $ 3.900",
    ],
    accent: "accent",
  },
  orders: {
    label: "Pedidos",
    title: "Flujo de pedidos",
    rows: [
      "Recibido                    06",
      "En preparación              11",
      "Listo                       07",
    ],
    accent: "secondary",
  },
  stock: {
    label: "Inventario",
    title: "Stock por sucursal",
    rows: [
      "Coca Cola 500cc            20",
      "Pan brioche                 08",
      "Cheddar                     02",
    ],
    accent: "success",
  },
  branches: {
    label: "Sucursales",
    title: "Todos tus locales",
    rows: [
      "Centro                      Activa",
      "Norte                       Activa",
      "Costanera                   Activa",
    ],
    accent: "secondary",
  },
  customers: {
    label: "Clientes",
    title: "Relaciones que crecen",
    rows: [
      "Clientes frecuentes        348",
      "Puntos entregados          1.240",
      "Nuevos este mes            42",
    ],
    accent: "accent",
  },
  analytics: {
    label: "Estadísticas",
    title: "Lo que pasa en tu negocio",
    rows: [
      "Ventas                     +18%",
      "Ticket promedio             $ 9.420",
      "Producto más pedido         IPA",
    ],
    accent: "warning",
  },
};

/** @summary Mockup liviano construido con datos de producto reales, sin imágenes pesadas ni screenshots. */
export function ProductMockup({
  mode = "dashboard",
  compact = false,
}: {
  mode?: MockupMode;
  compact?: boolean;
}) {
  const content = mockupContent[mode];
  const accent = `var(--mc-${content.accent})`;
  return (
    <div
      className={`overflow-hidden rounded-[1.4rem] border border-white/15 bg-[var(--mc-surface)] shadow-2xl shadow-black/40 ${compact ? "max-w-sm" : "w-full"}`}
    >
      <div className="flex items-center gap-2 border-b border-white/10 bg-[var(--mc-background-alt)] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 text-[10px] font-bold tracking-wide text-[var(--mc-text-muted)]">
          app.menuclick.local / {content.label.toLocaleLowerCase()}
        </span>
      </div>
      <div className="grid min-h-[300px] grid-cols-[78px_1fr] sm:min-h-[360px]">
        <aside className="border-r border-white/10 bg-[var(--mc-background-alt)] p-3">
          <div className="grid gap-2">
            <span className="h-7 rounded-lg bg-white/10" />
            <span className="h-2 rounded bg-white/10" />
            <span className="h-2 rounded bg-white/10" />
            <span className="h-2 rounded bg-white/10" />
            <span className="h-2 rounded bg-white/10" />
          </div>
        </aside>
        <div className="p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.22em]" style={{ color: accent }}>
                {content.label}
              </p>
              <h3 className="mt-2 text-xl font-black sm:text-2xl">{content.title}</h3>
            </div>
            <span
              className="rounded-lg px-2 py-1 text-[10px] font-black"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 15%, transparent)`, color: accent }}
            >
              Actualizado
            </span>
          </div>
          <div className="mt-6 grid gap-3">
            {content.rows.map((row) => (
              <div
                className="flex justify-between gap-3 rounded-xl border border-white/10 bg-white/[.035] px-3 py-3 text-xs text-slate-300"
                key={row}
              >
                <span>{row.split(/ {2,}/)[0]}</span>
                <strong style={{ color: accent }}>{row.split(/ {2,}/).slice(1).join(" ")}</strong>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-4 items-end gap-2">
            <span className="h-10 rounded-t bg-white/10" />
            <span
              className="h-16 rounded-t"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 40%, transparent)` }}
            />
            <span
              className="h-24 rounded-t"
              style={{ backgroundColor: `color-mix(in srgb, ${accent} 60%, transparent)` }}
            />
            <span className="h-20 rounded-t" style={{ backgroundColor: accent }} />
          </div>
        </div>
      </div>
    </div>
  );
}
