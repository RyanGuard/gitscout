export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="h-6 w-32 rounded bg-neutral-800/50 animate-pulse mb-6" />
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-neutral-800/30 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
