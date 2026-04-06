import Link from "next/link";
import { site } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="bg-cream px-5 py-20 sm:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-deep-elevated px-8 py-16 text-center text-cloud shadow-[0_24px_60px_-28px_rgba(10,12,15,0.45)] sm:px-16 sm:py-20">
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-10 h-56 w-56 rounded-full bg-accent/10 blur-3xl"
          aria-hidden
        />
        <h2 className="relative font-display text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          Ready to see your wall at full scale?
        </h2>
        <p className="relative mx-auto mt-5 max-w-lg text-pretty leading-relaxed text-cloud/70">
          Share photos, floor, and deadline—we’ll respond with next steps. {site.responseSla}
        </p>
        <div className="relative mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/contact"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-8 text-sm font-semibold text-ink transition hover:bg-accent-hover"
          >
            Start a project
          </Link>
          <a
            href={site.phoneHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-cloud/25 px-8 text-sm font-semibold text-cloud transition hover:border-cloud/50 hover:bg-white/5"
          >
            Call {site.phone}
          </a>
        </div>
      </div>
    </section>
  );
}
