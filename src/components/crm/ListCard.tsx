import Link from "next/link";
import { Users, Clock } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface ListCardProps {
  list: {
    id: string;
    name: string;
    description: string | null;
    entryCount: number;
    updatedAt: string;
  };
}

export function ListCard({ list }: ListCardProps) {
  return (
    <Link
      href={`/lists/${list.id}`}
      className="group block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-blue-600"
    >
      <h3 className="text-lg font-semibold text-neutral-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
        {list.name}
      </h3>
      {list.description && (
        <p className="mt-1 line-clamp-2 text-sm text-neutral-500 dark:text-neutral-400">
          {list.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {list.entryCount} candidate{list.entryCount !== 1 ? "s" : ""}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {timeAgo(list.updatedAt)}
        </span>
      </div>
    </Link>
  );
}
