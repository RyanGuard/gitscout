export default function MapLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="h-6 w-40 rounded bg-neutral-800/50 animate-pulse" />
        <div className="h-4 w-64 rounded bg-neutral-800/30 animate-pulse mt-2" />
      </div>
      <div className="rounded-xl border border-neutral-800/80 bg-neutral-900/60 p-5 mb-6">
        <div className="flex gap-2 mb-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-12 rounded-lg bg-neutral-800/30 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-neutral-800/30 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
