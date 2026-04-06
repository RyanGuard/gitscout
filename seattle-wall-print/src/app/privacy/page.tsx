import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy policy for ${site.name}.`,
  robots: { index: true, follow: true },
  alternates: { canonical: `${site.url}/privacy` },
};

export default function PrivacyPage() {
  return (
    <div className="bg-cream px-5 py-16 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl space-y-6 text-sm leading-relaxed sm:text-base">
        <h1 className="font-display text-3xl font-semibold text-ink">Privacy</h1>
        <p className="text-muted">
          This is a lightweight policy suitable for a marketing site with a contact form. Have counsel
          review before you handle sensitive data at scale.
        </p>
        <h2 className="font-display text-xl font-semibold text-ink">What we collect</h2>
        <p className="text-muted">
          When you submit the contact form, we store the fields you provide (name, email, project details)
          long enough to respond. If you enable email delivery (Resend), messages pass through that
          provider—see their privacy documentation.
        </p>
        <h2 className="font-display text-xl font-semibold text-ink">Analytics</h2>
        <p className="text-muted">
          If you add analytics (e.g. Vercel Analytics), update this section to name the vendor, what is
          collected, and retention.
        </p>
        <h2 className="font-display text-xl font-semibold text-ink">Contact</h2>
        <p className="text-muted">
          Questions about privacy:{" "}
          <a className="text-accent underline-offset-4 hover:underline" href={`mailto:${site.email}`}>
            {site.email}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
