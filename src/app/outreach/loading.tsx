export default function OutreachLoading() {
  return (
    <div className="flex h-[calc(100vh-1px)]">
      <div className="w-[280px] border-r border-neutral-800/50 p-4 space-y-3">
        <div className="flex gap-1 mb-4">{[1,2,3,4].map(i=><div key={i} className="flex-1 h-8 rounded bg-neutral-800/30 animate-pulse"/>)}</div>
        {[1,2,3,4,5].map(i=><div key={i} className="h-12 rounded-lg bg-neutral-800/30 animate-pulse"/>)}
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 w-48 rounded bg-neutral-800/50 animate-pulse"/>
        <div className="h-40 rounded-xl bg-neutral-800/30 animate-pulse"/>
      </div>
      <div className="w-[300px] border-l border-neutral-800/50 p-4 space-y-3">
        {[1,2,3,4,5].map(i=><div key={i} className="h-10 rounded-lg bg-neutral-800/30 animate-pulse"/>)}
      </div>
    </div>
  );
}
