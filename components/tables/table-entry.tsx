"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { writeBrowserText } from "@/lib/browser-compat";

/** @summary Guarda la mesa detectada por QR y conduce al visitante hacia la carta. */
export function TableEntry({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  useEffect(() => {
    writeBrowserText("laterne_mesa", code);
    const timer = window.setTimeout(() => router.replace(`/carta?mesa=${encodeURIComponent(code)}`), 500);
    return () => window.clearTimeout(timer);
  }, [code, router]);
  return <p className="mt-3 text-zinc-400">Reconocimos {name}. Abriendo la carta…</p>;
}
