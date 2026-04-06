import Link from "next/link";
import { navLinks, site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-deep text-cloud">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="font-display text-xl font-semibold tracking-tight text-accent-soft">
              {site.name}
            </p>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-cloud/70">{site.tagline}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-soft/90">
              Contact
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href={site.phoneHref} className="text-cloud/80 transition hover:text-cloud">
                  {site.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${site.email}`} className="text-cloud/80 transition hover:text-cloud">
                  {site.email}
                </a>
              </li>
              <li className="text-cloud/55">
                Serving {site.city}, WA &amp; Eastside
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-accent-soft/90">
              Explore
            </p>
            <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {navLinks.map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-cloud/75 transition hover:text-cloud">
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/privacy" className="text-cloud/75 transition hover:text-cloud">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-14 border-t border-white/10 pt-8 text-[11px] leading-relaxed text-cloud/45">
          The before/after section only lists same-location job documentation (empty until we publish verified
          pairs). Gallery uses on-wall Unsplash examples—not Seattle Wall Co. client photography—until you
          replace them with installs.
        </p>
      </div>
    </footer>
  );
}
