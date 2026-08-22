"use client";

import { useEffect, useRef, useState } from "react";

type NumberFlowProps = {
  value: number;
  className?: string;
  locale?: string;
  format?: Intl.NumberFormatOptions;
  duration?: number;
  prefix?: string;
  suffix?: string;
};

/** @summary Anima cambios numéricos breves y usa un valor estático cuando el usuario reduce el movimiento. */
export function NumberFlow({
  value,
  className,
  locale = "es-AR",
  format,
  duration = 220,
  prefix = "",
  suffix = "",
}: NumberFlowProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const currentValueRef = useRef(value);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const from = currentValueRef.current;
    const difference = value - from;

    if (media.matches || !Number.isFinite(value) || Math.abs(difference) < Number.EPSILON) {
      currentValueRef.current = value;
      setDisplayValue(value);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + difference * eased;
      currentValueRef.current = next;
      setDisplayValue(next);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
      else currentValueRef.current = value;
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  const formatter = new Intl.NumberFormat(locale, format);
  return (
    <span
      className={`inline-flex tabular-nums ${className ?? ""}`}
      aria-label={`${prefix}${formatter.format(value)}${suffix}`}
    >
      <span aria-hidden="true">
        {prefix}
        {formatter.format(displayValue)}
        {suffix}
      </span>
    </span>
  );
}
