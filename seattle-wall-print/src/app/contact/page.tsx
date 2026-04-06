import { ContactForm } from "@/app/contact/ContactForm";
import { site } from "@/lib/site";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description: `Request a wall printing quote in Seattle and the Puget Sound. ${site.responseSla}`,
  alternates: { canonical: `${site.url}/contact` },
  openGraph: {
    url: `${site.url}/contact`,
    title: `Contact ${site.name}`,
    description: `Book a site visit or share wall photos for a scoped proposal.`,
  },
};

export default function ContactPage() {
  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-24">
        <p className="eyebrow">Contact</p>
        <h1 className="mt-6 font-display text-4xl font-medium tracking-tight text-ink sm:text-5xl">
          Tell us about your wall
        </h1>
        <p className="mt-5 max-w-2xl text-pretty leading-relaxed text-muted">
          Share what you know today—rough dimensions, neighborhood, and how the space is used. We will
          confirm access needs and finishing options before we lock pricing.
        </p>

        <div className="mt-10 flex flex-wrap gap-3 text-sm">
          <a
            href={site.phoneHref}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-mist bg-white px-5 font-semibold text-ink-muted shadow-sm transition hover:border-accent/30"
          >
            Call {site.phone}
          </a>
          <a
            href={`mailto:${site.email}`}
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-mist bg-white px-5 font-semibold text-ink-muted shadow-sm transition hover:border-accent/30"
          >
            Email {site.email}
          </a>
        </div>
        <p className="mt-4 text-sm text-muted">{site.responseSla}</p>

        <ContactForm />

        <p className="mt-12 text-sm text-muted">
          Prefer context first?{" "}
          <Link href="/#work" className="font-semibold text-accent underline-offset-4 hover:underline">
            View selected work
          </Link>{" "}
          or our{" "}
          <Link href="/#pricing" className="font-semibold text-accent underline-offset-4 hover:underline">
            pricing guide
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
