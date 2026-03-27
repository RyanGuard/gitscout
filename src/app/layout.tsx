import type { Metadata } from "next";
import { Instrument_Sans, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/auth/Providers";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scout — Recruiting intelligence",
  description:
    "Recruiting intelligence platform. Source engineers, map connections, and build pipeline with real data.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://gitscout.dev"
  ),
  openGraph: {
    title: "Scout — Recruiting intelligence",
    description:
      "Recruiting intelligence platform. Source engineers, map connections, and build pipeline with real data.",
    siteName: "Scout",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scout — Recruiting intelligence",
    description:
      "Recruiting intelligence platform. Source engineers, map connections, and build pipeline with real data.",
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
      className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
