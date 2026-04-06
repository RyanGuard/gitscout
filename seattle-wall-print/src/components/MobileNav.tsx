"use client";

import Link from "next/link";
import { useState } from "react";
import { navLinks } from "@/lib/site";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="rounded-full border border-mist bg-white px-3.5 py-2 text-[13px] font-semibold text-ink shadow-sm"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
      >
        Menu
      </button>
      {open ? (
        <div
          id="mobile-nav"
          className="absolute left-5 right-5 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-mist/90 bg-cream/95 p-2 shadow-[0_20px_50px_-20px_rgba(10,12,15,0.35)] backdrop-blur-xl"
        >
          <nav className="flex flex-col py-2" aria-label="Mobile">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-2.5 text-[15px] font-medium text-ink-muted transition hover:bg-white hover:text-ink"
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
