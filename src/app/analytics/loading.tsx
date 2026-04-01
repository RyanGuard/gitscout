export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="h-6 w-32 rounded bg-neutral-800/50 animate-pulse mb-6" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-neutral-800/30 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-64 rounded-xl bg-neutral-800/30 animate-pulse" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-neutral-800/30 animate-pulse mt-4" />
    </div>
  );
}
