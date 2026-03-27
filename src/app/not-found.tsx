import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <SearchX className="h-12 w-12 text-neutral-300 dark:text-neutral-600" />
      <h1 className="mt-4 text-2xl font-bold text-neutral-800 dark:text-neutral-200">
        Page not found
      </h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-hover"
      >
        Go home
      </Link>
    </div>
  );
}
