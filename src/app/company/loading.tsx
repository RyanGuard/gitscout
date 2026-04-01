export default function CompanyLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="h-6 w-32 rounded bg-neutral-800/50 animate-pulse mb-6" />
      <div className="h-32 rounded-xl bg-neutral-800/30 animate-pulse mb-6" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-neutral-800/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
