import Image from "next/image";

/** @summary Portada de la landing pública y del preview del editor, con o sin imagen de fondo. */
export function LandingHero({
  eyebrow,
  title,
  subtitle,
  imageUrl,
  primaryColor,
  secondaryColor,
  backgroundColor,
  ctaHref,
  eventsHref,
  compact = false,
  unoptimized = false,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  ctaHref: string;
  eventsHref: string;
  compact?: boolean;
  unoptimized?: boolean;
}) {
  return (
    <section className={`relative ${compact ? "min-h-80" : "min-h-[calc(100vh-4rem)]"}`}>
      {imageUrl ? (
        <>
          <Image
            src={imageUrl}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized={unoptimized}
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
        <p className="font-bold uppercase tracking-[.3em] text-pink-400">{eyebrow}</p>
        <h1
          className={`mt-4 max-w-5xl font-black leading-[.92] tracking-tight ${
            compact ? "text-4xl" : "text-6xl sm:text-8xl lg:text-9xl"
          }`}
        >
          {title}
          <br />
          <span className="hero-word">birra.</span>
        </h1>
        <p
          className={`mt-7 max-w-xl leading-relaxed text-zinc-200 ${
            compact ? "text-base" : "text-lg"
          }`}
        >
          {subtitle}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <a className="btn" href={ctaHref}>
            Explorar la carta
          </a>
          <a className="btn btn-secondary" href={eventsHref}>
            Ver eventos
          </a>
        </div>
      </div>
    </section>
  );
}