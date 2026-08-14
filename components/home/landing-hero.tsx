"use client";

import Image from "next/image";
import { useState } from "react";
import type { LandingHeroConfig } from "@/lib/landing-content";

/** @summary Portada de la landing pública y del preview del editor, con o sin imagen de fondo. */
export function LandingHero({
  hero,
  primaryColor,
  secondaryColor,
  backgroundColor,
  compact = false,
  unoptimized = false,
  resolveHref,
}: {
  hero: LandingHeroConfig;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  compact?: boolean;
  unoptimized?: boolean;
  resolveHref?: (href: string) => string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!hero.imageUrl && !imageFailed;
  const href = resolveHref ?? ((value: string) => value);

  return (
    <section className={`relative ${compact ? "min-h-80" : "min-h-[calc(100vh-4rem)]"}`}>
      {showImage ? (
        <>
          <Image
            src={hero.imageUrl!}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized={unoptimized}
            onError={() => setImageFailed(true)}
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/65 to-black/10" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(120% 90% at 85% 0%, ${primaryColor}45 0%, transparent 55%), radial-gradient(100% 80% at 0% 100%, ${secondaryColor}38 0%, transparent 50%), linear-gradient(160deg, ${backgroundColor} 0%, #000 100%)`,
          }}
        />
      )}
      <div
        className={`shell relative flex flex-col justify-center ${
          compact ? "min-h-80 py-12" : "min-h-[calc(100vh-4rem)] py-24"
        }`}
      >
        <p className="font-bold uppercase tracking-[.3em] text-pink-400">{hero.eyebrow}</p>
        <h1
          className={`mt-4 max-w-5xl break-words font-black leading-[.92] tracking-tight ${
            compact ? "text-4xl" : "text-5xl sm:text-8xl lg:text-9xl"
          }`}
        >
          {hero.title}
          {hero.highlight && (
            <>
              <br />
              <span className="hero-word">{hero.highlight}</span>
            </>
          )}
        </h1>
        <p
          className={`mt-7 max-w-xl leading-relaxed text-zinc-200 ${
            compact ? "text-base" : "text-lg"
          }`}
        >
          {hero.description}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          {hero.primaryButton.visible && (
            <a className="btn" href={href(hero.primaryButton.href)}>
              {hero.primaryButton.label}
            </a>
          )}
          {hero.secondaryButton.visible && (
            <a className="btn btn-secondary" href={href(hero.secondaryButton.href)}>
              {hero.secondaryButton.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}