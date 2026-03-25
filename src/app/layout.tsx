import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GitScout - Discover Talented Developers",
  description:
    "Search and discover talented developers on GitHub. Filter by language, location, and expertise.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://gitscout.dev"
  ),
  openGraph: {
    title: "GitScout - Discover Talented Developers",
    description:
      "Search and discover talented developers on GitHub. Filter by language, location, and expertise.",
    siteName: "GitScout",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GitScout - Discover Talented Developers",
    description:
      "Search and discover talented developers on GitHub. Filter by language, location, and expertise.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
