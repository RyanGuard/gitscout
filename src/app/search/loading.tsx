export default function SearchLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="h-10 w-full rounded-lg bg-neutral-800/30 animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 rounded bg-neutral-800/30 animate-pulse" />
          ))}
        </div>
        <div className="md:col-span-2 space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-neutral-800/30 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
