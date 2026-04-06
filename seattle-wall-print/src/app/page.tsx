import { BeforeAfterSection } from "@/components/BeforeAfterSection";
import { CompareSection } from "@/components/CompareSection";
import { FaqJsonLd } from "@/components/JsonLd";
import { FAQSection } from "@/components/FAQSection";
import { FinalCta } from "@/components/FinalCta";
import { GallerySection } from "@/components/GallerySection";
import { Hero } from "@/components/Hero";
import { PricingSection } from "@/components/PricingSection";
import { ProcessSection } from "@/components/ProcessSection";
import { ServiceArea } from "@/components/ServiceArea";
import { TrustRow } from "@/components/TrustRow";
import { beforeAfterItems } from "@/data/beforeAfter";
import { galleryItems } from "@/data/gallery";
import { site } from "@/lib/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wall printing & mural graphics in Seattle, WA",
  description: `${site.tagline} Serving Seattle, Bellevue, Redmond, and the broader Puget Sound.`,
  alternates: { canonical: site.url },
  openGraph: {
    url: site.url,
    title: `${site.name} — Wall printing & murals in Seattle, WA`,
    description: site.tagline,
  },
};

export default function HomePage() {
  return (
    <>
      <FaqJsonLd />
      <Hero />
      <TrustRow />
      <BeforeAfterSection items={beforeAfterItems} />
      <GallerySection items={galleryItems} />
      <ProcessSection />
      <PricingSection />
      <CompareSection />
      <ServiceArea />
      <FAQSection />
      <FinalCta />
    </>
  );
}
