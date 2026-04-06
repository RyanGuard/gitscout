import Link from "next/link";
import { site } from "@/lib/site";

export function ServiceArea() {
  return (
    <section className="border-y border-mist/80 bg-white px-5 py-24 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="eyebrow">Service area</p>
          <h2 className="mt-6 font-display text-3xl font-medium tracking-tight text-ink text-balance sm:text-4xl">
            Local crews, familiar with Puget Sound buildings
          </h2>
          <p className="mt-5 text-pretty leading-relaxed text-muted">
            Core coverage includes {site.serviceAreas.join(", ")}. Projects elsewhere in Washington ship
            with travel built into the proposal—no mystery fees.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {site.serviceAreas.map((area) => (
              <li key={area}>
                <span className="inline-block rounded-full border border-mist bg-cream/60 px-3.5 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  {area}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            className="mt-10 inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-7 text-sm font-semibold text-cloud transition hover:bg-accent hover:text-ink"
          >
            Schedule a walkthrough
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-mist shadow-[0_20px_50px_-28px_rgba(10,12,15,0.35)] ring-1 ring-ink/5">
          <iframe
            title="Seattle service area map"
            className="aspect-[4/3] w-full border-0 grayscale-[0.35] contrast-[1.05]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d172139.4156597632!2d-122.48218359999999!3d47.61302659999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x5490102c93e59e55%3A0x86bc3144e0b1f78c!2sSeattle%2C%20WA!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus"
          />
        </div>
      </div>
    </section>
  );
}
