"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type StickyStoryStep = { eyebrow: string; title: string; description: string; visual: ReactNode };

/** @summary Storytelling sticky progresivo sin secuestrar el scroll ni requerir una librería externa. */
export function StickyStorySection({ eyebrow, title, intro, steps, reverse = false }: { eyebrow: string; title: string; intro: string; steps: StickyStoryStep[]; reverse?: boolean }) {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(Number((visible.target as HTMLElement).dataset.storyIndex ?? 0));
    }, { rootMargin: "-35% 0px -45%", threshold: [0.1, 0.45, 0.8] });
    stepRefs.current.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, [steps.length]);
  const visual = steps[active]?.visual;
  return <section className="marketing-story mx-auto min-w-0 max-w-[1280px] px-5 py-24 sm:py-36"><div className="min-w-0 max-w-3xl"><p className="marketing-eyebrow">{eyebrow}</p><h2 className="break-words mt-4 text-4xl font-black tracking-tight sm:text-6xl">{title}</h2><p className="mt-5 text-lg leading-relaxed text-slate-400">{intro}</p></div><div className={`mt-16 grid min-w-0 gap-12 lg:grid-cols-2 lg:gap-20 ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`}><div className="hidden min-w-0 lg:sticky lg:top-28 lg:order-1 lg:block lg:h-[min(68vh,680px)] lg:self-start"><div className="flex h-full min-w-0 flex-col justify-center"><div className="story-visual min-h-[380px] min-w-0 transition-opacity duration-500">{visual}</div><div className="mt-6 flex items-center gap-2" aria-label={`Paso ${active + 1} de ${steps.length}`}>{steps.map((step, index) => <span className={`h-1.5 rounded-full transition-all duration-300 ${index === active ? "w-10 bg-[#e8ff6a]" : "w-2 bg-white/20"}`} key={step.title} />)}</div></div></div><div className={`min-w-0 lg:order-2 ${reverse ? "lg:order-1" : ""}`}>{steps.map((step, index) => <article className={`story-step flex min-h-[68vh] min-w-0 flex-col justify-center border-b border-white/10 py-12 first:pt-0 last:border-0 lg:min-h-[72vh] ${index === active ? "is-active" : ""}`} data-story-index={index} key={step.title} ref={(element) => { stepRefs.current[index] = element; }}><div className="mb-8 min-w-0 lg:hidden">{step.visual}</div><p className="marketing-eyebrow">{step.eyebrow}</p><h3 className="mt-3 break-words text-3xl font-black sm:text-4xl">{step.title}</h3><p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-400">{step.description}</p><span className="mt-8 text-sm font-black text-[#e8ff6a]">{String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span></article>)}</div></div></section>;
}
