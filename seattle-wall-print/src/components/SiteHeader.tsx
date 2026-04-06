import Link from "next/link";
import { navLinks, site } from "@/lib/site";
import { MobileNav } from "@/components/MobileNav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink/5 bg-cream/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="group flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
          <span className="font-display text-[1.05rem] font-semibold tracking-tight text-ink transition group-hover:text-accent">
            {site.name}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted sm:text-[11px]">
            Seattle
          </span>
        </Link>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-[13px] font-medium text-ink-muted transition hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <MobileNav />
          <Link
            href="/contact"
            className="rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-cloud shadow-sm transition hover:bg-accent hover:text-ink sm:px-5"
          >
            Get a quote
          </Link>
        </div>
      </div>
    </header>
  );
}
