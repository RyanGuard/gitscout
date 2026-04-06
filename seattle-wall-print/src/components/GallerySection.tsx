"use client";

import Image from "next/image";
import { useState } from "react";
import type { GalleryItem } from "@/data/gallery";

type Props = { items: GalleryItem[] };

export function GallerySection({ items }: Props) {
  const [active, setActive] = useState<GalleryItem | null>(null);

  return (
    <section id="work" className="scroll-mt-28 bg-cream px-5 py-24 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="eyebrow">Example work</p>
          <h2 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink text-balance sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            Seattle, Bellevue &amp; Eastside scenarios we love building
          </h2>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted">
            Every tile below is a <strong className="font-medium text-ink">real wall with something on it</strong>
            —murals, type, graphics, or illustrated programs—not empty offices or landscape-only stock. Images
            are still Unsplash references, not Seattle Wall Co. client photos; swap in your installs when ready.
          </p>
        </header>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item)}
              style={{ animationDelay: `${index * 40}ms` }}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-mist/80 bg-white text-left shadow-[0_1px_3px_rgba(10,12,15,0.06)] transition duration-300 hover:-translate-y-1 hover:border-accent/25 hover:shadow-[0_18px_40px_-24px_rgba(10,12,15,0.35)] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-cream-dark">
                {item.secondarySrc ? (
                  <div className="absolute inset-0 grid grid-cols-2 gap-px bg-mist">
                    <div className="relative">
                      <Image
                        src={item.src}
                        alt={item.sliceLabels?.primary ? `${item.title} — ${item.sliceLabels.primary}` : item.title}
                        fill
                        className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                        sizes="(min-width: 1024px) 17vw, (min-width: 640px) 25vw, 50vw"
                      />
                      {item.sliceLabels ? (
                        <span className="absolute bottom-2 left-2 rounded bg-ink/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cloud">
                          {item.sliceLabels.primary}
                        </span>
                      ) : null}
                    </div>
                    <div className="relative">
                      <Image
                        src={item.secondarySrc}
                        alt={item.secondaryAlt ?? item.title}
                        fill
                        className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                        sizes="(min-width: 1024px) 17vw, (min-width: 640px) 25vw, 50vw"
                      />
                      {item.sliceLabels ? (
                        <span className="absolute bottom-2 right-2 rounded bg-ink/80 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cloud">
                          {item.sliceLabels.secondary}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <Image
                    src={item.src}
                    alt={`${item.title} — ${item.outcome}`}
                    fill
                    className="object-cover transition duration-700 ease-out group-hover:scale-[1.04]"
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  />
                )}
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
                  aria-hidden
                />
                <span className="absolute bottom-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cloud backdrop-blur-sm">
                  {item.category}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{item.outcome}</p>
                <p className="mt-3 text-[11px] font-medium text-muted/70">Photo · {item.photoCredit}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-deep/80 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={() => setActive(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 z-10 rounded-full border border-cloud/20 bg-white/10 px-4 py-2 text-sm font-medium text-cloud transition hover:bg-white/20"
            onClick={() => setActive(null)}
          >
            Close
          </button>
          <div
            className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto overflow-x-hidden rounded-2xl border border-white/10 bg-deep-elevated shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {active.secondarySrc ? (
              <div className="grid gap-1 bg-ink p-1 sm:grid-cols-2">
                <div className="relative aspect-[4/3] w-full sm:aspect-auto sm:min-h-[220px]">
                  <Image src={active.src} alt={active.title} fill className="object-cover" />
                  {active.sliceLabels ? (
                    <span className="absolute bottom-3 left-3 rounded bg-ink/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cloud">
                      {active.sliceLabels.primary}
                    </span>
                  ) : null}
                </div>
                <div className="relative aspect-[4/3] w-full sm:aspect-auto sm:min-h-[220px]">
                  <Image
                    src={active.secondarySrc}
                    alt={active.secondaryAlt ?? active.title}
                    fill
                    className="object-cover"
                  />
                  {active.sliceLabels ? (
                    <span className="absolute bottom-3 right-3 rounded bg-ink/85 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cloud">
                      {active.sliceLabels.secondary}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="relative aspect-[4/3] w-full bg-ink sm:aspect-video">
                <Image src={active.src} alt={active.title} fill className="object-contain" />
              </div>
            )}
            <div className="border-t border-white/10 p-6 text-cloud">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-soft">
                {active.category}
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold">{active.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cloud/80">{active.outcome}</p>
              <p className="mt-4 text-[11px] text-cloud/55">Photo · {active.photoCredit}</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
