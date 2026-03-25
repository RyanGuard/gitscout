"use client";

import Link from "next/link";
import { GitBranch, Search, Target, List, Settings } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200/50 bg-white/80 backdrop-blur-xl dark:border-neutral-800/50 dark:bg-[#0a0a0f]/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg group">
          <GitBranch className="h-5 w-5 text-indigo-500 transition-transform group-hover:rotate-12" />
          <span className="hidden sm:inline">GitScout</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-1.5 text-sm">
          <Link
            href="/search"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-white"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Search</span>
          </Link>
          <Link
            href="/match"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-white"
          >
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Match</span>
          </Link>
          <Link
            href="/lists"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-white"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lists</span>
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-white sm:hidden"
          >
            <Settings className="h-3.5 w-3.5" />
          </Link>
          <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-800" />
          <ThemeToggle />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
