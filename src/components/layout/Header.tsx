"use client";

import Link from "next/link";
import { useState } from "react";
import { GitBranch, Search, Target, List, Map, Link2, Menu, X } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV_LINKS = [
  { href: "/search", label: "Search", icon: Search },
  { href: "/match", label: "Match", icon: Target },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/map", label: "Map", icon: Map },
  { href: "/connections", label: "Connections", icon: Link2 },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/50 bg-white/80 backdrop-blur-xl dark:border-neutral-800/50 dark:bg-[#0a0a0f]/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
          <GitBranch className="h-5 w-5 text-indigo-500 transition-transform group-hover:rotate-12" />
          <span className="hidden sm:inline">GitScout</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-1.5 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-white"
            >
              <link.icon className="h-3.5 w-3.5" />
              {link.label}
            </Link>
          ))}
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-800" />
          <ThemeToggle />
          <AuthButton />
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <ThemeToggle />
          <AuthButton />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="rounded-lg p-1.5 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/50"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="border-t border-neutral-200/50 bg-white/95 backdrop-blur-xl sm:hidden dark:border-neutral-800/50 dark:bg-[#0a0a0f]/95">
          <nav className="mx-auto max-w-7xl px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800/50"
              >
                <link.icon className="h-4 w-4 text-neutral-400 dark:text-neutral-400" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
