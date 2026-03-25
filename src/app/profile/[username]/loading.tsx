export default function ProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 animate-pulse">
      <div className="mb-6 h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />

      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="h-28 w-28 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-700" />
          <div className="flex-1 space-y-3 w-full">
            <div className="h-8 w-48 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="h-4 w-full max-w-md rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="flex gap-4 pt-2">
              <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
            <div className="flex gap-3 pt-2">
              <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-4 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
            <div className="h-10 w-40 rounded-lg bg-neutral-200 dark:bg-neutral-700" />
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="h-5 w-24 rounded bg-neutral-200 dark:bg-neutral-700 mb-4" />
        <div className="h-2.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700" />
        <div className="mt-2 flex gap-4">
          <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
          <div className="h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
        </div>
      </div>

      <div className="mt-6">
        <div className="h-5 w-36 rounded bg-neutral-200 dark:bg-neutral-700 mb-4" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900"
            >
              <div className="h-5 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-2 h-4 w-full rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-3 flex gap-2">
                <div className="h-5 w-16 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="h-5 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
