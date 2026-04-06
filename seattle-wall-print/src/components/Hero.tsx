import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/site";

/** On-wall mural reference (stock — not a Seattle Wall Co. project). */
const heroImage =
  "https://images.unsplash.com/photo-1765366417031-60bc8543189c?auto=format&fit=crop&w=1800&q=88";

export function Hero() {
  return (
    <section className="relative isolate min-h-[min(100vh,56rem)] bg-deep lg:min-h-[min(100vh,44rem)]">
      <div className="grid min-h-[inherit] lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {/* Copy column */}
        <div className="relative z-10 order-2 flex flex-col justify-center px-5 py-16 sm:px-8 sm:py-20 lg:order-1 lg:px-12 xl:px-20">
          <div
            className="pointer-events-none absolute -left-32 top-1/4 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
            aria-hidden
          />
          <p className="reveal reveal-delay-1 eyebrow text-accent-soft">
            Seattle · Wall printing
          </p>
          <h1 className="reveal reveal-delay-2 mt-8 max-w-xl text-balance font-display text-4xl font-medium leading-[1.12] tracking-tight text-cloud sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            Monumental walls, printed and installed with precision.
          </h1>
          <p className="reveal reveal-delay-3 mt-6 max-w-md text-pretty text-base leading-relaxed text-cloud/75 sm:text-lg">
            Brand features, retail graphics, and event backdrops—color-managed and finished for real
            buildings across the Puget Sound.
          </p>
          <div className="reveal reveal-delay-4 mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-7 text-sm font-semibold text-ink shadow-lg shadow-black/25 transition hover:bg-accent-hover"
            >
              Book a site visit
            </Link>
            <Link
              href="#work"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-cloud/25 bg-cloud/5 px-7 text-sm font-semibold text-cloud backdrop-blur-sm transition hover:border-accent-soft/50 hover:bg-cloud/10"
            >
              View work
            </Link>
          </div>
          <dl className="reveal reveal-delay-4 mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-cloud/15 pt-10 text-left sm:gap-8">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-cloud/45">
                Response
              </dt>
              <dd className="mt-1 text-sm font-medium text-cloud">1 business day</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-cloud/45">
                Coverage
              </dt>
              <dd className="mt-1 text-sm font-medium text-cloud">Seattle + Eastside</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-cloud/45">
                Call
              </dt>
              <dd className="mt-1 text-sm font-medium text-cloud">
                <a href={site.phoneHref} className="underline decoration-cloud/30 underline-offset-4 hover:decoration-accent-soft">
                  {site.phone}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        {/* Image column */}
        <div className="relative order-1 min-h-[280px] lg:order-2 lg:min-h-full">
          <Image
            src={heroImage}
            alt="Architectural interior with space for large-scale wall graphics"
            fill
            priority
            className="object-cover object-center lg:object-[center_40%]"
            sizes="(min-width: 1024px) 48vw, 100vw"
          />
          {/* Depth: left blend on desktop, bottom blend on mobile */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-deep via-deep/25 to-transparent lg:bg-gradient-to-r lg:from-deep lg:via-deep/15 lg:to-transparent"
            aria-hidden
          />
          <div
            className="absolute inset-0 mix-blend-overlay bg-accent/10 opacity-40 lg:opacity-25"
            aria-hidden
          />
          <p className="absolute bottom-4 right-4 hidden max-w-[14rem] text-right text-[10px] font-medium uppercase tracking-wider text-cloud/50 lg:block">
            Stock on-wall reference — use your installs here
          </p>
        </div>
      </div>
    </section>
  );
}
