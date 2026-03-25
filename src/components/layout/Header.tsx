import Link from "next/link";
import { GitBranch, Search, Target, List } from "lucide-react";
import { AuthButton } from "@/components/auth/AuthButton";
import { SoundToggle } from "@/components/ui/SoundToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <GitBranch className="h-6 w-6" />
          <span className="hidden sm:inline">GitScout</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-5 text-sm">
          <Link
            href="/search"
            className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <Search className="h-4 w-4 sm:hidden" />
            <span>Search</span>
          </Link>
          <Link
            href="/match"
            className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <Target className="h-4 w-4 sm:hidden" />
            <span>Match</span>
          </Link>
          <Link
            href="/lists"
            className="flex items-center gap-1.5 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
          >
            <List className="h-4 w-4 sm:hidden" />
            <span>Lists</span>
          </Link>
          <SoundToggle />
          <AuthButton />
        </nav>
      </div>
    </header>
  );
}
