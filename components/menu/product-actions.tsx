"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { trackEvent } from "@/components/analytics/tracker";
import { copyBrowserText, readBrowserJson, writeBrowserJson } from "@/lib/browser-compat";

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
      const favorites = readBrowserJson<number[]>("laterne_favoritos", []);
      setFavorite(Array.isArray(favorites) && favorites.includes(product.id));
      const history = readBrowserJson<ProductActionData[]>("laterne_vistos", []);
      const validHistory = Array.isArray(history) ? history : [];
      const nextHistory = [product, ...validHistory.filter((item) => item.id !== product.id)].slice(0, 12);
      writeBrowserJson("laterne_vistos", nextHistory);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [product]);

  /** @summary Agrega el producto al pedido persistido o incrementa su cantidad si ya estaba elegido. */
  function addToOrder() {
    try {
      const stored = readBrowserJson<Array<ProductActionData & { quantity: number }>>("laterne_carrito", []);
      const current = Array.isArray(stored) ? stored : [];
      const existing = current.find((item) => item.id === product.id);
      const next = existing
        ? current.map((item) =>
            item.id === product.id
              ? { ...item, quantity: Math.max(1, Number(item.quantity || 1)) + 1 }
              : item,
          )
        : [...current, { ...product, quantity: 1 }];
      const persisted = writeBrowserJson("laterne_carrito", next);
      trackEvent("product.add", { entityType: "product", entityId: product.id });
      setMessage(
        persisted
          ? "Producto agregado al pedido."
          : "Producto agregado para esta visita. Safari no permitió guardarlo de forma permanente.",
      );
    } catch {
      setMessage("No pudimos guardar el producto en este dispositivo.");
    }
  }

  /** @summary Alterna el producto dentro de la colección de favoritos guardada en el dispositivo. */
  function toggleFavorite() {
    const stored = readBrowserJson<number[]>("laterne_favoritos", []);
    const current = Array.isArray(stored) ? stored.filter(Number.isInteger) : [];
    const enabled = !current.includes(product.id);
    const next = enabled ? [...current, product.id] : current.filter((id) => id !== product.id);
    const persisted = writeBrowserJson("laterne_favoritos", next);
    setFavorite(enabled);
    trackEvent("product.favorite", {
      entityType: "product",
      entityId: product.id,
      metadata: { enabled },
    });
    setMessage(
      enabled
        ? persisted
          ? "Guardado en favoritos."
          : "Guardado durante esta visita. Safari bloqueó la persistencia privada."
        : "Quitado de favoritos.",
    );
  }

  /** @summary Comparte la ficha con la función nativa disponible o copia su dirección. */
  async function shareProduct() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text: product.description, url });
        setMessage("Producto compartido.");
        return;
      }
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
    }
    const copied = await copyBrowserText(url);
    setMessage(copied ? "Enlace copiado." : `Copiá este enlace: ${url}`);
  }

  /** @summary Genera localmente el QR individual de la ficha para mostrarlo o descargarlo sin terceros. */
  async function showQr() {
    let dataUrl = "";
    try {
      dataUrl = await QRCode.toDataURL(window.location.href, {
        width: 720,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#09090b", light: "#ffffff" },
      });
    } catch {
      setMessage("No pudimos generar el código QR en este navegador.");
      return;
    }
    const result = await Swal.fire({
      title: product.name,
      text: "Escaneá para abrir esta ficha individual.",
      imageUrl: dataUrl,
      imageAlt: `Código QR de ${product.name}`,
      imageWidth: 320,
      showCancelButton: true,
      confirmButtonText: "Descargar QR",
      cancelButtonText: "Cerrar",
      background: "#18181b",
      color: "#fafafa",
    });
    if (!result.isConfirmed) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `qr-${product.slug}.png`;
    anchor.click();
  }

  const soldOut = product.availability?.toLocaleLowerCase("es") === "agotado";

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
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
        <button className="btn btn-secondary min-h-12" onClick={() => void showQr()} type="button">
          Código QR
        </button>
      </div>
      <p className="mt-3 min-h-6 text-sm text-pink-300" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
