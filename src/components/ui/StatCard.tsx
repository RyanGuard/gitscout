import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900",
        className
      )}
    >
      {icon && <div className="text-neutral-400">{icon}</div>}
      <div>
        <p className="text-2xl font-bold text-neutral-900 dark:text-white">
          {value}
        </p>
        <p className="text-sm text-neutral-500">{label}</p>
      </div>
    </div>
  );
}
