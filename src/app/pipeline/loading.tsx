export default function PipelineLoading() {
  return (
    <div className="px-4 py-6">
      <div className="h-6 w-32 rounded bg-neutral-800/50 animate-pulse mb-6" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="space-y-3">
            <div className="h-8 w-24 rounded bg-neutral-800/40 animate-pulse mb-2" />
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-28 rounded-xl bg-neutral-800/30 animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
