export const site = {
  name: "Seattle Wall Co.",
  tagline:
    "Large-format wall printing for Seattle, Bellevue, Eastside workplaces, retail, and events.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://seattlewallco.com",
  phone: "(360) 317-5952",
  phoneHref: "tel:+13603175952",
  email: "hello@seattlewallco.com",
  city: "Seattle",
  region: "WA",
  serviceAreas: ["Seattle", "Bellevue", "Redmond", "Kirkland", "Tacoma corridor"],
  responseSla: "We reply within one business day.",
} as const;

export const navLinks = [
  { href: "/#work", label: "Work" },
  { href: "/#process", label: "Process" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#compare", label: "Why us" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;
