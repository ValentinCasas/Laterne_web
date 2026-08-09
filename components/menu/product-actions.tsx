"use client";

import { useEffect, useState } from "react";
import { trackEvent } from "@/components/analytics/tracker";

type ProductActionData = {
  id: number;
  slug: string;
  name: string;
  description: string;
  price: number;
  availability: string | null;
  image: string;
};

/** @summary Permite guardar, compartir o agregar un producto individual al pedido local. */
export function ProductActions({ product }: { product: ProductActionData }) {
  const [favorite, setFavorite] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    trackEvent("product.view", { entityType: "product", entityId: product.id });
    const timer = window.setTimeout(() => {
      try {
        const favorites = JSON.parse(localStorage.getItem("laterne_favoritos") ?? "[]") as number[];
        setFavorite(favorites.includes(product.id));
      } catch {
        setFavorite(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [product.id]);

  /** @summary Agrega el producto al pedido persistido o incrementa su cantidad si ya estaba elegido. */
  function addToOrder() {
    try {
      const current = JSON.parse(localStorage.getItem("laterne_carrito") ?? "[]") as Array<
        ProductActionData & { quantity: number }
      >;
      const existing = current.find((item) => item.id === product.id);
      const next = existing
        ? current.map((item) =>
            item.id === product.id
              ? { ...item, quantity: Math.max(1, Number(item.quantity || 1)) + 1 }
              : item,
          )
        : [...current, { ...product, quantity: 1 }];
      localStorage.setItem("laterne_carrito", JSON.stringify(next));
      trackEvent("product.add", { entityType: "product", entityId: product.id });
      setMessage("Producto agregado al pedido.");
    } catch {
      setMessage("No pudimos guardar el producto en este dispositivo.");
    }
  }

  /** @summary Alterna el producto dentro de la colección de favoritos guardada en el dispositivo. */
  function toggleFavorite() {
    try {
      const current = JSON.parse(localStorage.getItem("laterne_favoritos") ?? "[]") as number[];
      const next = current.includes(product.id)
        ? current.filter((id) => id !== product.id)
        : [...current, product.id];
      localStorage.setItem("laterne_favoritos", JSON.stringify(next));
      setFavorite(next.includes(product.id));
      trackEvent("product.favorite", {
        entityType: "product",
        entityId: product.id,
        metadata: { enabled: next.includes(product.id) },
      });
      setMessage(next.includes(product.id) ? "Guardado en favoritos." : "Quitado de favoritos.");
    } catch {
      setMessage("No pudimos actualizar tus favoritos.");
    }
  }

  /** @summary Comparte la ficha con la función nativa disponible o copia su dirección. */
  async function shareProduct() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.name, text: product.description, url });
      else {
        await navigator.clipboard.writeText(url);
        setMessage("Enlace copiado.");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") setMessage("No pudimos compartir el producto.");
    }
  }

  const soldOut = product.availability?.toLocaleLowerCase("es") === "agotado";

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <button
          className="btn min-h-12 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={soldOut}
          onClick={addToOrder}
          type="button"
        >
          {soldOut ? "Temporalmente agotado" : "Agregar al pedido"}
        </button>
        <button
          className="btn btn-secondary min-h-12"
          onClick={toggleFavorite}
          type="button"
          aria-pressed={favorite}
        >
          {favorite ? "♥ Guardado" : "♡ Favorito"}
        </button>
        <button className="btn btn-secondary min-h-12" onClick={shareProduct} type="button">
          Compartir
        </button>
      </div>
      <p className="mt-3 min-h-6 text-sm text-pink-300" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
