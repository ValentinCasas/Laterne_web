"use client";

import { useState } from "react";

const AVATAR_COLORS = [
  "bg-pink-500/20 text-pink-200",
  "bg-violet-500/20 text-violet-200",
  "bg-sky-500/20 text-sky-200",
  "bg-emerald-500/20 text-emerald-200",
  "bg-amber-500/20 text-amber-200",
  "bg-rose-500/20 text-rose-200",
];

/** @summary Devuelve las iniciales de un nombre para el avatar por defecto. */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toLocaleUpperCase("es");
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toLocaleUpperCase("es");
}

/** @summary Color de fondo determinístico a partir del nombre. */
function colorFor(name: string) {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]!;
}

export type AvatarSize = "sm" | "md" | "lg";

const SIZES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

/**
 * @summary Avatar de usuario con fallback a iniciales.
 *
 * Si la imagen existe y carga correctamente se muestra; si falla o no hay
 * URL válida, se muestra un círculo con las iniciales del nombre para no
 * exponer nunca un ícono de imagen rota.
 */
export function UserAvatar({
  name,
  src,
  size = "md",
  className,
  status,
}: {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
  status?: "online" | "away";
}) {
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(src) && !errored;

  const visual = showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src!}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={`${SIZES[size]} shrink-0 rounded-full object-cover overflow-hidden flex-shrink-0 ${className ?? ""}`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full font-black ${colorFor(name)} ${className ?? ""}`}
    >
      {initials(name)}
    </span>
  );

  if (!status) return visual;
  return (
    <span className="relative inline-grid shrink-0">
      {visual}
      <span
        className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--admin-surface-overlay)] ${status === "online" ? "bg-emerald-400" : "bg-amber-400"}`}
        aria-label={status === "online" ? "En línea" : "Ausente"}
        title={status === "online" ? "En línea" : "Ausente"}
      />
    </span>
  );
}
