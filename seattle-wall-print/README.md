# Seattle Wall Co. — marketing site

Next.js (App Router) marketing site for a Seattle wall-printing business: gallery, pricing guidance, comparison table, FAQ with structured data, contact form with optional Resend email, and SEO primitives (metadata, `sitemap.xml`, `robots.txt`, Open Graph image).

## Development

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for metadata, sitemap, JSON-LD |
| `RESEND_API_KEY` | Send lead notifications via [Resend](https://resend.com) |
| `CONTACT_INBOX_EMAIL` | Recipient for contact form |
| `RESEND_FROM_EMAIL` | Verified sender domain in Resend (use `onboarding@resend.dev` for tests) |

Without Resend configured, **production** submissions show a friendly error; **development** logs the message to the server console.

## Content checklist before launch

1. Replace demo Unsplash assets in `src/data/gallery.ts` with your photography.
2. Update `src/lib/site.ts` with real phone, email, legal business name, and insurance/license copy in `TrustRow`.
3. Adjust pricing bands in `src/components/PricingSection.tsx` and the comparison copy in `src/components/CompareSection.tsx` so every claim is accurate.

## Deploy

Deploy to Vercel (or any Node host). Set environment variables in the hosting dashboard. See `docs/launch-playbook.md` for GBP and first-customer workflows.
