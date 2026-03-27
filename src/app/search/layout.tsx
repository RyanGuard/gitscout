import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Developers — GitScout",
  description: "Search and discover talented developers on GitHub. Filter by language, location, and expertise.",
  openGraph: {
    title: "Search Developers — GitScout",
    description: "Search and discover talented developers on GitHub.",
  },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
