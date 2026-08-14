"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { scopedFetch } from "@/lib/client-routing";

type ProductOption = {
  id: number;
  productId: number;
  groupId: number | null;
  name: string;
  active: boolean;
  sortOrder: number;
  price?: string | number;
  priceAdjustment?: string | number;
};
type OptionGroup = {
  id: number;
  productId: number;
  kind: "variant" | "extra";
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  active: boolean;
};
type ProductChoice = { id: number; name: string };

function price(option: ProductOption) {
  return Number(option.priceAdjustment ?? option.price ?? 0);
}

/** @summary Administra grupos y opciones en una estructura que coincide con la experiencia de compra pública. */
export function ProductOptionsManager({
  products,
  initialVariants,
  initialExtras,
  initialGroups,
}: {
  products: ProductChoice[];
  initialVariants: ProductOption[];
  initialExtras: ProductOption[];
  initialGroups: OptionGroup[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? 0);
  const [kind, setKind] = useState<"variant" | "extra">("variant");
  const [variants, setVariants] = useState(initialVariants);
  const [extras, setExtras] = useState(initialExtras);
  const [groups, setGroups] = useState(initialGroups);
  const selectedProduct = products.find((product) => product.id === productId);
  const options = (kind === "variant" ? variants : extras)
    .filter((option) => option.productId === productId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const visibleGroups = groups
    .filter((group) => group.productId === productId && group.kind === kind)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const ungrouped = options.filter((option) => !option.groupId);
  const optionCount = (kind === "variant" ? variants : extras).filter(
    (option) => option.productId === productId,
  ).length;

  const createGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const response = await scopedFetch("/api/admin/product-option-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        kind,
        name: data.get("name"),
        required: data.get("required") === "on",
        minSelections: Number(data.get("minSelections")),
        maxSelections: Number(data.get("maxSelections")),
        sortOrder: Number(data.get("sortOrder")),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { group?: OptionGroup; error?: string };
    if (!response.ok || !result.group) {
      return void Swal.fire({
        title: "No se pudo crear el grupo",
        text: result.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
    setGroups((current) => [...current, result.group!]);
    formElement.reset();
  };

  const createOption = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    const response = await scopedFetch("/api/admin/product-options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        productId,
        groupId: Number(data.get("groupId")) || null,
        name: data.get("name"),
        price: Number(data.get("price") || 0),
        sortOrder: Number(data.get("sortOrder") || options.length),
        active: true,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { item?: ProductOption; error?: string };
    if (!response.ok || !result.item) {
      return void Swal.fire({
        title: "No se pudo crear",
        text: result.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
    if (kind === "variant") setVariants((current) => [...current, result.item!]);
    else setExtras((current) => [...current, result.item!]);
    formElement.reset();
  };

  const editOption = async (option: ProductOption) => {
    const result = await Swal.fire({
      title: "Editar opción",
      html: `<input id="option-name" class="swal2-input" value="${option.name.replaceAll('"', "&quot;")}"><input id="option-price" class="swal2-input" type="number" step="0.01" value="${price(option)}"><input id="option-order" class="swal2-input" type="number" value="${option.sortOrder}"><label style="display:flex;gap:.5rem;justify-content:center"><input id="option-active" type="checkbox" ${option.active ? "checked" : ""}> Disponible</label>`,
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
        groupId: option.groupId,
      }),
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await scopedFetch(`/api/admin/product-options/${kind}/${option.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.value),
    });
    const body = (await response.json().catch(() => ({}))) as { item?: ProductOption; error?: string };
    if (!response.ok || !body.item) {
      return void Swal.fire({
        title: "No se pudo guardar",
        text: body.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
    const setter = kind === "variant" ? setVariants : setExtras;
    setter((current) => current.map((item) => (item.id === option.id ? body.item! : item)));
  };

  const removeOption = async (option: ProductOption) => {
    const confirm = await Swal.fire({
      title: `¿Eliminar ${option.name}?`,
      text: "Los pedidos anteriores conservarán su información.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirm.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/product-options/${kind}/${option.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    const setter = kind === "variant" ? setVariants : setExtras;
    setter((current) => current.filter((item) => item.id !== option.id));
  };

  const editGroup = async (group: OptionGroup) => {
    const result = await Swal.fire({
      title: "Editar grupo",
      html: `<input id="group-name" class="swal2-input" value="${group.name.replaceAll('"', "&quot;")}"><div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem"><input id="group-min" class="swal2-input" type="number" min="0" value="${group.minSelections}"><input id="group-max" class="swal2-input" type="number" min="1" value="${group.maxSelections}"></div><label style="display:flex;gap:.5rem;justify-content:center;margin:.5rem 0"><input id="group-required" type="checkbox" ${group.required ? "checked" : ""}> Elección obligatoria</label><label style="display:flex;gap:.5rem;justify-content:center"><input id="group-active" type="checkbox" ${group.active ? "checked" : ""}> Grupo activo</label>`,
      showCancelButton: true,
      confirmButtonText: "Guardar",
      cancelButtonText: "Cancelar",
      background: "#18181b",
      color: "#fafafa",
      preConfirm: () => ({
        name: (document.querySelector("#group-name") as HTMLInputElement).value,
        minSelections: Number((document.querySelector("#group-min") as HTMLInputElement).value),
        maxSelections: Number((document.querySelector("#group-max") as HTMLInputElement).value),
        required: (document.querySelector("#group-required") as HTMLInputElement).checked,
        active: (document.querySelector("#group-active") as HTMLInputElement).checked,
        sortOrder: group.sortOrder,
      }),
    });
    if (!result.isConfirmed || !result.value) return;
    const response = await scopedFetch(`/api/admin/product-option-groups/${group.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result.value),
    });
    const body = (await response.json().catch(() => ({}))) as { group?: OptionGroup; error?: string };
    if (!response.ok || !body.group) {
      return void Swal.fire({
        title: "No se pudo guardar",
        text: body.error,
        icon: "error",
        background: "#18181b",
        color: "#fafafa",
      });
    }
    setGroups((current) => current.map((item) => (item.id === group.id ? body.group! : item)));
  };

  const removeGroup = async (group: OptionGroup) => {
    const confirm = await Swal.fire({
      title: `¿Eliminar el grupo “${group.name}”?`,
      text: "Las opciones se conservarán sin grupo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!confirm.isConfirmed) return;
    const response = await scopedFetch(`/api/admin/product-option-groups/${group.id}`, {
      method: "DELETE",
    });
    if (!response.ok) return;
    setGroups((current) => current.filter((item) => item.id !== group.id));
    const setter = kind === "variant" ? setVariants : setExtras;
    setter((current) =>
      current.map((item) => (item.groupId === group.id ? { ...item, groupId: null } : item)),
    );
  };

  const groupSummary = visibleGroups.map((group) => ({
    ...group,
    options: options.filter((option) => option.groupId === group.id),
  }));

  return (
    <section>
      <AdminPageHeader
        eyebrow="Carta avanzada"
        title="Opciones de producto"
        description="Organizá cada producto en grupos de selección claros, con reglas y opciones reutilizables."
        section="opciones-producto"
      >
        <label className="mt-6 block max-w-xl">
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
      </AdminPageHeader>

      {!selectedProduct ? (
        <div className="card p-12 text-center text-[var(--admin-muted)]">
          Creá un producto antes de configurar opciones.
        </div>
      ) : (
        <>
          <div className="mb-5 flex gap-2 border-b border-[var(--admin-border)]" role="tablist" aria-label="Tipo de opciones">
            {(["variant", "extra"] as const).map((candidate) => (
              <button
                className={`border-b-2 px-4 py-3 text-sm font-black ${
                  kind === candidate
                    ? "border-[var(--admin-primary)] text-white"
                    : "border-transparent text-[var(--admin-muted)]"
                }`}
                key={candidate}
                onClick={() => setKind(candidate)}
                role="tab"
                aria-selected={kind === candidate}
                type="button"
              >
                {candidate === "variant" ? "Variantes" : "Agregados"}
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">
                  {candidate === "variant"
                    ? variants.filter((option) => option.productId === productId).length
                    : extras.filter((option) => option.productId === productId).length}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(280px,.75fr)_minmax(0,1.5fr)]">
            <section className="space-y-6">
              <article className="card p-5">
                <h2 className="text-xl font-black">Nuevo grupo</h2>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  {kind === "variant" ? "Ej. Tamaño, presentación o combinación." : "Ej. Extras, ingredientes o preferencias."}
                </p>
                <form className="mt-5 space-y-4" onSubmit={createGroup}>
                  <label>
                    <span className="label">Nombre del grupo</span>
                    <input className="input" name="name" required placeholder={kind === "variant" ? "Tamaño" : "Extras"} />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="label">Elegir mínimo</span>
                      <input className="input" name="minSelections" type="number" min="0" defaultValue="0" />
                    </label>
                    <label>
                      <span className="label">Elegir máximo</span>
                      <input className="input" name="maxSelections" type="number" min="1" defaultValue="1" />
                    </label>
                  </div>
                  <label className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] p-3 text-sm">
                    <input name="required" type="checkbox" /> Elección obligatoria
                  </label>
                  <input name="sortOrder" type="hidden" value={visibleGroups.length} />
                  <button className="btn w-full">Crear grupo</button>
                </form>
              </article>

              <article className="card p-5">
                <h3 className="font-black">Nueva opción</h3>
                <p className="mt-1 text-sm text-[var(--admin-muted)]">
                  Una opción es {kind === "variant" ? "una variante" : "un agregado"} con su propio precio.
                </p>
                <form className="mt-4 space-y-3" onSubmit={createOption}>
                  <label>
                    <span className="label">Nombre</span>
                    <input className="input" name="name" required placeholder="Ej. Doble" />
                  </label>
                  <label>
                    <span className="label">Grupo</span>
                    <select className="input" name="groupId">
                      <option value="">Sin grupo</option>
                      {visibleGroups.map((group) => (
                        <option value={group.id} key={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="label">Diferencia de precio</span>
                    <input className="input" name="price" type="number" step="0.01" defaultValue="0" />
                  </label>
                  <button className="btn btn-secondary w-full">Agregar opción</button>
                </form>
              </article>
            </section>

            <section className="space-y-4">
              <div className="card p-4 text-sm text-[var(--admin-muted)]">
                El cliente verá un grupo de selección por cada grupo activo, con {optionCount}{" "}
                {optionCount === 1 ? "opción" : "opciones"} disponibles en total.
              </div>
              {groupSummary.map((group) => (
                <article className="card overflow-hidden" key={group.id}>
                  <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--admin-border)] p-5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-[var(--admin-primary)]">
                        Grupo {group.sortOrder + 1} {group.active ? "" : "· inactivo"}
                      </p>
                      <h2 className="mt-1 text-2xl font-black">{group.name}</h2>
                      <p className="mt-1 text-sm text-[var(--admin-muted)]">
                        {group.required ? "Obligatorio" : "Opcional"} · elegir entre {group.minSelections} y{" "}
                        {group.maxSelections}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--admin-muted)]">{group.options.length} opciones</span>
                      <button className="btn btn-secondary px-3 py-2 text-sm" onClick={() => void editGroup(group)} type="button">
                        Editar
                      </button>
                      <button
                        className="rounded-xl border border-red-500/20 px-3 py-2 text-sm text-red-300"
                        onClick={() => void removeGroup(group)}
                        type="button"
                      >
                        Eliminar
                      </button>
                    </div>
                  </header>
                  <div className="divide-y divide-white/10">
                    {group.options.map((option) => (
                      <OptionRow key={option.id} option={option} onEdit={() => void editOption(option)} onRemove={() => void removeOption(option)} />
                    ))}
                    {!group.options.length && (
                      <p className="p-6 text-sm text-[var(--admin-muted)]">No hay opciones todavía. Agregá la primera desde el panel.</p>
                    )}
                  </div>
                </article>
              ))}
              <article className="card overflow-hidden">
                <header className="border-b border-[var(--admin-border)] p-5">
                  <h2 className="text-lg font-black">Sin grupo</h2>
                  <p className="text-sm text-[var(--admin-muted)]">Opciones existentes que todavía no fueron organizadas.</p>
                </header>
                <div className="divide-y divide-white/10">
                  {ungrouped.map((option) => (
                    <OptionRow key={option.id} option={option} onEdit={() => void editOption(option)} onRemove={() => void removeOption(option)} />
                  ))}
                  {!ungrouped.length && (
                    <p className="p-6 text-sm text-[var(--admin-muted)]">Todas las opciones están organizadas.</p>
                  )}
                </div>
              </article>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function OptionRow({
  option,
  onEdit,
  onRemove,
}: {
  option: ProductOption;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <strong>{option.name}</strong>
        <p className="mt-1 text-sm text-[var(--admin-muted)]">
          {price(option) > 0 ? `+ $${price(option).toLocaleString("es-AR")}` : "Sin adicional"} ·{" "}
          {option.active ? "Disponible" : "Oculto"} · orden {option.sortOrder}
        </p>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-secondary px-3 py-2 text-sm" onClick={onEdit} type="button">
          Editar
        </button>
        <button className="rounded-xl border border-red-500/20 px-3 py-2 text-sm text-red-300" onClick={onRemove} type="button">
          Eliminar
        </button>
      </div>
    </div>
  );
}