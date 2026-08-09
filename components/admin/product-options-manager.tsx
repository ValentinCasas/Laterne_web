"use client";

import { useMemo, useState } from "react";
import Swal from "sweetalert2";

type ProductOption = {
  id: number;
  productId: number;
  name: string;
  active: boolean;
  sortOrder: number;
  price?: string | number;
  priceAdjustment?: string | number;
};
type ProductChoice = { id: number; name: string };

/** @summary Obtiene el precio correspondiente según se trate de una variante o un agregado. */
function optionPrice(option: ProductOption) {
  return Number(option.priceAdjustment ?? option.price ?? 0);
}

/** @summary Escapa el nombre de una opción antes de mostrarlo en un diálogo HTML. */
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character,
  );
}

/** @summary Administra tamaños, presentaciones y agregados disponibles para cada producto. */
export function ProductOptionsManager({
  products,
  initialVariants,
  initialExtras,
}: {
  products: ProductChoice[];
  initialVariants: ProductOption[];
  initialExtras: ProductOption[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [variants, setVariants] = useState(initialVariants);
  const [extras, setExtras] = useState(initialExtras);
  const selectedProduct = products.find((product) => product.id === productId);
  const visibleVariants = useMemo(
    () =>
      variants
        .filter((option) => option.productId === productId)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [productId, variants],
  );
  const visibleExtras = useMemo(
    () =>
      extras
        .filter((option) => option.productId === productId)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [extras, productId],
  );

  /** @summary Crea una opción nueva y la incorpora a la columna correspondiente. */
  async function createOption(event: React.FormEvent<HTMLFormElement>, kind: "variant" | "extra") {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/product-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        productId,
        name: form.get("name"),
        price: Number(form.get("price") || 0),
        sortOrder: Number(form.get("sortOrder") || 0),
        active: true,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { item?: ProductOption; error?: string };
    if (!response.ok || !result.item) {
      await Swal.fire({
        title: "No se pudo crear",
        text: result.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    if (kind === "variant") setVariants((current) => [...current, result.item!]);
    else setExtras((current) => [...current, result.item!]);
    event.currentTarget.reset();
  }

  /** @summary Edita una opción mediante un formulario breve y validado presentado con SweetAlert. */
  async function editOption(option: ProductOption, kind: "variant" | "extra") {
    const result = await Swal.fire({
      title: kind === "variant" ? "Editar variante" : "Editar agregado",
      html: `<input id="option-name" class="swal2-input" maxlength="120" value="${escapeHtml(option.name)}"><input id="option-price" class="swal2-input" type="number" step="0.01" value="${optionPrice(option)}"><input id="option-order" class="swal2-input" type="number" value="${option.sortOrder}"><label style="display:flex;gap:.6rem;justify-content:center"><input id="option-active" type="checkbox" ${option.active ? "checked" : ""}> Disponible</label>`,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      preConfirm: () => ({
        name: (document.querySelector("#option-name") as HTMLInputElement).value,
        price: Number((document.querySelector("#option-price") as HTMLInputElement).value),
        sortOrder: Number((document.querySelector("#option-order") as HTMLInputElement).value),
        active: (document.querySelector("#option-active") as HTMLInputElement).checked,
      }),
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await fetch(`/api/admin/product-options/${kind}/${option.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.value),
    });
    const body = (await response.json().catch(() => ({}))) as { item?: ProductOption; error?: string };
    if (!response.ok || !body.item) {
      await Swal.fire({
        title: "No se pudo guardar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    const setter = kind === "variant" ? setVariants : setExtras;
    setter((current) => current.map((candidate) => (candidate.id === option.id ? body.item! : candidate)));
  }

  /** @summary Confirma y elimina una opción que ya no debe ofrecerse en la carta. */
  async function removeOption(option: ProductOption, kind: "variant" | "extra") {
    const confirmation = await Swal.fire({
      title: `¿Eliminar ${option.name}?`,
      text: "Los pedidos anteriores conservarán el nombre y precio utilizados.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirmation.isConfirmed) return;
    const response = await fetch(`/api/admin/product-options/${kind}/${option.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      await Swal.fire({
        title: "No se pudo eliminar",
        text: body.error ?? "Intentá nuevamente.",
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
      return;
    }
    if (kind === "variant")
      setVariants((current) => current.filter((candidate) => candidate.id !== option.id));
    else setExtras((current) => current.filter((candidate) => candidate.id !== option.id));
  }

  return (
    <section>
      <header className="mb-6 rounded-3xl border border-white/10 bg-zinc-950/80 p-5 sm:p-7">
        <p className="section-eyebrow">Carta avanzada</p>
        <h1 className="mt-2 text-3xl font-black sm:text-5xl">Variantes y agregados</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Ofrecé tamaños, presentaciones y extras sin duplicar productos.
        </p>
        <label className="mt-5 block max-w-lg">
          <span className="label">Producto</span>
          <select
            className="input"
            value={productId}
            onChange={(event) => setProductId(Number(event.target.value))}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      {selectedProduct ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {(
            [
              ["variant", "Variantes", "Ej. Pinta", "Diferencia de precio", visibleVariants],
              ["extra", "Agregados", "Ej. Cheddar extra", "Precio adicional", visibleExtras],
            ] as const
          ).map(([kind, title, placeholder, priceLabel, options]) => (
            <section className="card overflow-hidden" key={kind}>
              <header className="border-b border-white/10 p-5">
                <h2 className="text-2xl font-black">{title}</h2>
                <p className="text-sm text-zinc-500">Para {selectedProduct.name}</p>
              </header>
              <form
                className="grid gap-3 border-b border-white/10 p-4 sm:grid-cols-[1fr_150px_90px_auto] sm:items-end"
                onSubmit={(event) => createOption(event, kind)}
              >
                <label>
                  <span className="label">Nombre</span>
                  <input className="input" name="name" required placeholder={placeholder} />
                </label>
                <label>
                  <span className="label">{priceLabel}</span>
                  <input className="input" name="price" type="number" step="0.01" defaultValue={0} />
                </label>
                <label>
                  <span className="label">Orden</span>
                  <input className="input" name="sortOrder" type="number" defaultValue={options.length} />
                </label>
                <button className="btn">Agregar</button>
              </form>
              <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4">
                {options.map((option) => (
                  <article
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                    key={option.id}
                  >
                    <div>
                      <strong>{option.name}</strong>
                      <p className="text-xs text-zinc-500">
                        {optionPrice(option)
                          ? `${optionPrice(option) > 0 ? "+" : ""}$${optionPrice(option)}`
                          : "Sin adicional"}{" "}
                        · {option.active ? "Disponible" : "Oculto"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary px-3"
                        onClick={() => editOption(option, kind)}
                        type="button"
                      >
                        Editar
                      </button>
                      <button
                        className="rounded-xl border border-red-500/20 px-3 text-red-300"
                        onClick={() => removeOption(option, kind)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
                {!options.length && (
                  <p className="p-8 text-center text-zinc-500">Todavía no agregaste opciones.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center text-zinc-500">
          Creá un producto antes de configurar opciones.
        </div>
      )}
    </section>
  );
}
