import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-neutral-300 dark:text-neutral-600">
        <rect x="4" y="4" width="40" height="40" rx="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2" />
        <circle cx="24" cy="18" r="5" fill="#D4A017" />
        <path d="M15 34c0-5 4-9 9-9s9 4 9 9" stroke="#D4A017" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <h1 className="mt-4 text-2xl font-bold text-neutral-800 dark:text-neutral-200">
        Page not found
      </h1>
      <p className="mt-2 text-neutral-500 dark:text-neutral-400">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg px-4 py-2 text-sm font-medium transition-colors"
        style={{ background: "#C8A55A", color: "#19191A" }}
      >
        Go home
      </Link>
    </div>
  );
}
