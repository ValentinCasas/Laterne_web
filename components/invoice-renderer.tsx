/**
 * Renderizador único del comprobante.
 *
 * Tanto la vista previa del diseñador como la impresión/PDF usan este componente:
 * un diseño guardado produce exactamente el mismo documento en ambos contextos.
 */

import { money } from "@/lib/format";
import {
  groupBlockRows,
  invoiceFontClass,
  invoicePresetLabels,
  type InvoiceBlock,
  type InvoiceDesign,
} from "@/lib/invoice-design";

export type InvoiceRenderItem = {
  productName: string;
  variantName?: string | null;
  extras?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoiceRenderData = {
  issuerName: string;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  number: string;
  customerName: string;
  customerTaxId?: string | null;
  orderReference: string;
  orderDate: string;
  items: InvoiceRenderItem[];
  currency: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  notes?: string | null;
  terms?: string | null;
  qrUrl?: string | null;
};

/** @summary Reemplaza tokens de campos dinámicos solo si el texto los incluye explícitamente. */
function resolveText(text: string, data: InvoiceRenderData): string {
  const replacements: Record<string, string> = {
    "{{cliente.nombre}}": data.customerName,
    "{{cliente.documento}}": data.customerTaxId ?? "",
    "{{pedido.numero}}": data.orderReference,
    "{{pedido.fecha}}": data.orderDate,
    "{{pedido.total}}": money(data.total, data.currency),
    "{{negocio.nombre}}": data.issuerName,
  };
  return text.replace(/\{\{[a-zA-Z0-9_.]+\}\}/g, (token) => replacements[token] ?? token);
}

const rowSpacing: Record<"compact" | "normal" | "wide", string> = {
  compact: "py-1",
  normal: "py-2",
  wide: "py-3.5",
};

/**
 * @summary Renderiza un bloque de texto respetando el diseño del comprobante.
 */
function BlockText({
  block,
  text,
  className = "",
}: {
  block: InvoiceBlock;
  text: string;
  className?: string;
}) {
  return (
    <p
      className={className}
      style={{
        fontSize: block.fontSize,
        fontWeight: block.bold ? 800 : undefined,
        color: block.color ?? undefined,
        backgroundColor: block.background ?? undefined,
        textAlign: block.align,
        whiteSpace: "pre-wrap",
      }}
    >
      {text}
    </p>
  );
}

/** @summary Renderiza un bloque individual del comprobante. */
function RenderBlock({ block, data }: { block: InvoiceBlock; data: InvoiceRenderData }) {
  const addressLine = [data.address, data.city].filter(Boolean).join(", ");

  switch (block.type) {
    case "logo":
      return (
        <span
          className="grid h-12 w-12 place-items-center rounded-full text-sm font-black text-white"
          style={{ backgroundColor: block.color ?? "#18181b" }}
          aria-hidden="true"
        >
          {(data.issuerName || "LM").slice(0, 2).toUpperCase()}
        </span>
      );
    case "issuerName":
      return (
        <div style={{ textAlign: block.align }}>
          <p className="font-black" style={{ fontSize: block.fontSize ?? 14 }}>
            {data.issuerName}
          </p>
          {addressLine && (
            <p className="mt-0.5 text-zinc-500" style={{ fontSize: (block.fontSize ?? 12) - 2 }}>
              {addressLine}
            </p>
          )}
          {data.taxId && (
            <p className="text-zinc-500" style={{ fontSize: (block.fontSize ?? 12) - 2 }}>
              CUIT {data.taxId}
            </p>
          )}
        </div>
      );
    case "title":
      return (
        <BlockText
          block={block}
          text={block.text ? resolveText(block.text, data) : "Comprobante interno no fiscal"}
          className="font-black uppercase tracking-wide"
        />
      );
    case "number":
      return (
        <BlockText block={block} text={`Comprobante N° ${data.number}`} className="font-bold tabular-nums" />
      );
    case "customerData":
      return (
        <div style={{ textAlign: block.align }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cliente</p>
          <p className="font-black" style={{ fontSize: block.fontSize }}>
            {data.customerName}
          </p>
          {data.customerTaxId && (
            <p className="text-zinc-500" style={{ fontSize: (block.fontSize ?? 12) - 2 }}>
              {data.customerTaxId}
            </p>
          )}
        </div>
      );
    case "orderData":
      return (
        <div style={{ textAlign: block.align }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Pedido</p>
          <p className="font-black" style={{ fontSize: block.fontSize }}>
            {data.orderReference}
          </p>
          <p className="text-zinc-500" style={{ fontSize: (block.fontSize ?? 12) - 2 }}>
            {data.orderDate}
          </p>
        </div>
      );
    case "table":
      return (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-white" style={{ backgroundColor: block.color ?? "#18181b", fontWeight: 800 }}>
              {block.tableColumns?.product && <th className="px-2 py-2">Producto</th>}
              {block.tableColumns?.quantity && <th className="px-2 py-2 text-center">Cant.</th>}
              {block.tableColumns?.unitPrice && <th className="px-2 py-2 text-right">Precio unit.</th>}
              {block.tableColumns?.total && <th className="px-2 py-2 text-right">Total</th>}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, index) => (
              <tr
                className="break-inside-avoid border-b border-zinc-100 align-top"
                key={`${item.productName}-${index}`}
              >
                {block.tableColumns?.product && (
                  <td className={`px-2 ${rowSpacing[block.tableStyle ?? "normal"]}`}>
                    <strong>{item.productName}</strong>
                    {block.tableColumns?.variant && item.variantName && (
                      <span className="block text-zinc-500" style={{ fontSize: 11 }}>
                        · {item.variantName}
                      </span>
                    )}
                    {block.tableColumns?.extras && item.extras && (
                      <span className="block text-zinc-500" style={{ fontSize: 11 }}>
                        + {item.extras}
                      </span>
                    )}
                  </td>
                )}
                {block.tableColumns?.quantity && (
                  <td className={`px-2 text-center tabular-nums ${rowSpacing[block.tableStyle ?? "normal"]}`}>
                    {item.quantity}
                  </td>
                )}
                {block.tableColumns?.unitPrice && (
                  <td className={`px-2 text-right tabular-nums ${rowSpacing[block.tableStyle ?? "normal"]}`}>
                    {money(item.unitPrice, data.currency)}
                  </td>
                )}
                {block.tableColumns?.total && (
                  <td
                    className={`px-2 text-right font-bold tabular-nums ${rowSpacing[block.tableStyle ?? "normal"]}`}
                  >
                    {money(item.total, data.currency)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "subtotal":
    case "discount":
    case "delivery":
    case "total": {
      const isTotal = block.type === "total";
      const value =
        block.type === "subtotal"
          ? data.subtotal
          : block.type === "discount"
            ? -data.discount
            : block.type === "delivery"
              ? data.deliveryFee
              : data.total;
      const label =
        block.type === "subtotal"
          ? "Subtotal"
          : block.type === "discount"
            ? "Descuento"
            : block.type === "delivery"
              ? "Envío"
              : "Total";
      return (
        <p
          className="flex items-center justify-between gap-4 tabular-nums"
          style={{
            fontSize: block.fontSize ?? (isTotal ? 16 : 12),
            fontWeight: block.bold || isTotal ? 800 : undefined,
            color: block.color ?? (isTotal ? "#111111" : undefined),
            textAlign: block.align,
            backgroundColor: block.background ?? undefined,
          }}
        >
          <span>{label}</span>
          <strong>{money(value, data.currency)}</strong>
        </p>
      );
    }
    case "qr":
      return data.qrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- El QR es un data URL efímero que debe imprimirse sin pasar por el optimizador.
        <img
          className="h-20 w-20 rounded border border-zinc-200 bg-white object-contain p-1"
          src={data.qrUrl}
          alt="Código QR del comprobante"
        />
      ) : (
        <span className="grid h-20 w-20 place-items-center rounded border border-zinc-200 bg-zinc-50 text-[9px] font-black text-zinc-400">
          QR
        </span>
      );
    case "notes":
      return data.notes ? (
        <div className="rounded bg-zinc-50 p-3" style={{ textAlign: block.align }}>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Observaciones</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{data.notes}</p>
        </div>
      ) : null;
    case "customText":
      return (
        <BlockText block={block} text={block.text ? resolveText(block.text, data) : "Texto personalizado"} />
      );
    case "separator":
      return <hr className="border-t" style={{ borderColor: block.color ?? "#d4d4d8", opacity: 0.7 }} />;
    case "footer":
      return (
        <p
          className="text-zinc-500"
          style={{
            fontSize: block.fontSize,
            fontWeight: block.bold ? 700 : undefined,
            textAlign: block.align,
            color: block.color ?? undefined,
            whiteSpace: "pre-wrap",
          }}
        >
          {block.text
            ? resolveText(block.text, data)
            : (data.terms ?? "Documento operativo. No válido como comprobante fiscal.")}
        </p>
      );
    default:
      return null;
  }
}

/** @summary Renderiza el comprobante completo a partir del diseño y los datos. */
export function InvoiceRenderer({
  design,
  data,
  interactive = false,
  selectedId = null,
  onSelect,
}: {
  design: InvoiceDesign;
  data: InvoiceRenderData;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const rows = groupBlockRows(design.blocks);
  return (
    <div
      className={`invoice-sheet bg-white text-zinc-950 ${invoiceFontClass[design.font]}`}
      style={{ color: "#111111", fontFamily: undefined }}
    >
      {interactive && (
        <div
          className="flex items-start justify-between gap-4 border-b border-dashed border-zinc-200 pb-2"
          style={{ fontSize: 10, color: "#9ca3af" }}
        >
          <span>Documento operativo · No fiscal</span>
          <span>Vista previa · {invoicePresetLabels[design.preset]}</span>
        </div>
      )}
      {rows.map((row, rowIndex) => {
        const rowKey = row.map((block) => block.id).join("|");
        return (
          <div
            className={`grid gap-6 ${row.length === 2 ? "grid-cols-2 items-start" : "grid-cols-1"} ${
              rowIndex > 0 ? "mt-3" : "mt-4"
            }`}
            key={rowKey}
          >
            {row.map((block) => {
              const rendered = <RenderBlock block={block} data={data} />;
              if (!interactive) {
                return (
                  <div
                    className={block.type === "table" ? "break-inside-auto" : "break-inside-avoid"}
                    key={block.id}
                  >
                    {rendered}
                  </div>
                );
              }
              const selected = selectedId === block.id;
              return (
                <button
                  className={`block w-full rounded text-left ring-2 transition ${
                    selected ? "ring-pink-500" : "ring-transparent hover:ring-zinc-300"
                  } ${block.type === "table" ? "break-inside-auto" : "break-inside-avoid"}`}
                  key={block.id}
                  onClick={() => onSelect?.(block.id)}
                  type="button"
                  title="Seleccionar elemento"
                >
                  {rendered}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
