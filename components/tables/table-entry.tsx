"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { writeBrowserText } from "@/lib/browser-compat";

/** @summary Guarda la mesa detectada por QR y conduce al visitante hacia la carta de su sucursal. */
export function TableEntry({ code, name, branchPath = "" }: { code: string; name: string; branchPath?: string }) {
  const router = useRouter();
  useEffect(() => {
    writeBrowserText("laterne_mesa", code);
    const timer = window.setTimeout(
      () => router.replace((`${branchPath}/carta?mesa=${encodeURIComponent(code)}`) as Route),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [code, branchPath, router]);
  return <p className="mt-3 text-zinc-400">Reconocimos {name}. Abriendo la carta…</p>;
}