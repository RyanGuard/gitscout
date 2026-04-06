import Image from "next/image";
import Link from "next/link";
import type { BeforeAfterItem } from "@/data/beforeAfter";

type Props = { items: BeforeAfterItem[] };

export function BeforeAfterSection({ items }: Props) {
  const hasPairs = items.length > 0;

  return (
    <section id="before-after" className="scroll-mt-28 border-y border-mist/80 bg-white px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p className="eyebrow">Before &amp; after</p>
          <h2 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink text-balance sm:text-4xl">
            {hasPairs ? "Same site, same wall" : "Same-site documentation — gallery coming"}
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted">
            {hasPairs ? (
              <>
                Each pair below is <strong className="font-medium text-ink">one job, one location</strong>
                —prep or blank wall, then finished graphics. No stock mashups.
              </>
            ) : (
              <>
                We only show <strong className="font-medium text-ink">before and after from the identical
                space</strong> (same camera angle when possible). That library is still growing as we finish
                Seattle and Eastside installs—we&apos;re not padding it with unrelated stock.
              </>
            )}
          </p>
        </header>

        {hasPairs ? (
          <ul className="mt-14 space-y-16">
            {items.map((item) => (
              <li key={item.id}>
                <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">{item.neighborhood}</p>
                    <p className="mt-1 text-sm text-muted">{item.context}</p>
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Same-site pair
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <figure className="overflow-hidden rounded-2xl border border-mist bg-cream shadow-sm">
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={item.beforeSrc}
                        alt={item.beforeAlt}
                        fill
                        className="object-cover"
                        sizes="(min-width: 640px) 45vw, 100vw"
                      />
                    </div>
                    <figcaption className="border-t border-mist px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-muted">
                      Before
                    </figcaption>
                  </figure>
                  <figure className="overflow-hidden rounded-2xl border border-accent/25 bg-cream shadow-md ring-1 ring-accent/20">
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={item.afterSrc}
                        alt={item.afterAlt}
                        fill
                        className="object-cover"
                        sizes="(min-width: 640px) 45vw, 100vw"
                      />
                    </div>
                    <figcaption className="border-t border-accent/20 bg-accent/10 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-ink">
                      After
                    </figcaption>
                  </figure>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-mist bg-cream/80 px-6 py-10 text-center sm:px-10">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-muted">
              When you&apos;re ready, we&apos;ll light this section up with documented Puget Sound walls—
              empty drywall or patch-out, then the same surface with your print.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-7 text-sm font-semibold text-cloud transition hover:bg-accent hover:text-ink"
            >
              Book a site visit
            </Link>
          </div>
        )}

        <p className="mt-12 text-center text-xs leading-relaxed text-muted sm:text-sm">
          Planning work in{" "}
          <strong className="font-medium text-ink">Seattle</strong>,{" "}
          <strong className="font-medium text-ink">Bellevue</strong>, or the{" "}
          <strong className="font-medium text-ink">Eastside</strong>? We&apos;ll scope prep, access, and
          proofing on <em>your</em> wall.
        </p>
      </div>
    </section>
  );
}
