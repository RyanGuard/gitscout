export default function AlertsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="h-6 w-48 rounded bg-neutral-800/50 animate-pulse mb-6" />
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-neutral-800/30 animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-neutral-800/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
