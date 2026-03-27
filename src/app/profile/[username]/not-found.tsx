import { SearchX } from "lucide-react";
import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
      <SearchX className="mx-auto h-12 w-12 text-neutral-300 dark:text-neutral-600" />
      <h2 className="mt-4 text-xl font-semibold text-neutral-700 dark:text-neutral-300">
        Developer not found
      </h2>
      <p className="mt-2 text-neutral-500">
        This developer hasn&apos;t been indexed yet, or the username is incorrect.
      </p>
      <Link
        href="/search"
        className="mt-6 inline-block rounded-lg bg-gold px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gold-hover"
      >
        Search developers
      </Link>
    </div>
  );
}
