"use client";

import { useEffect, useState } from "react";

/** @summary Barra de progreso semántica con entrada discreta y fallback para movimiento reducido. */
export function AnimatedProgress({
  value,
  label,
  className,
  tone = "primary",
}: {
  value: number;
  label: string;
  className?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const [rendered, setRendered] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(clamped);
      return;
    }
    const frame = window.requestAnimationFrame(() => setRendered(clamped));
    return () => window.cancelAnimationFrame(frame);
  }, [clamped]);

  const tones = {
    primary: "bg-[var(--admin-primary-strong)]",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-rose-400",
    info: "bg-sky-400",
  };

  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-white/[.06] ${className ?? ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
    >
      <span
        className={`block h-full rounded-full transition-[width] duration-300 ease-out ${tones[tone]}`}
        style={{ width: `${rendered}%` }}
      />
    </div>
  );
}
