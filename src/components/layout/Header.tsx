import Link from "next/link";
import { GitBranch, Search, ExternalLink } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <GitBranch className="h-6 w-6" />
          <span className="hidden sm:inline">GitScout</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6 text-sm">
          <Link
            href="/search"
            className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <Search className="h-4 w-4 sm:hidden" />
            <span>Search</span>
          </Link>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <span className="hidden sm:inline">GitHub</span>
            <ExternalLink className="h-3.5 w-3.5 hidden sm:block" />
            <span className="sm:hidden">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
