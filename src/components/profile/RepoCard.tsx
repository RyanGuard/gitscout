import { Star, GitFork } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, getLanguageColor, timeAgo } from "@/lib/utils";
import type { RepositorySummary } from "@/types";

interface RepoCardProps {
  repo: RepositorySummary;
}

export function RepoCard({ repo }: RepoCardProps) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-start justify-between gap-2">
        <h4 className="truncate font-semibold text-gold dark:text-gold">
          {repo.name}
        </h4>
        <div className="flex shrink-0 items-center gap-3 text-sm text-neutral-500">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5" />
            {formatNumber(repo.stars)}
          </span>
          <span className="flex items-center gap-1">
            <GitFork className="h-3.5 w-3.5" />
            {formatNumber(repo.forks)}
          </span>
        </div>
      </div>
      {repo.description && (
        <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
          {repo.description}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        {repo.language && (
          <Badge color={getLanguageColor(repo.language)}>{repo.language}</Badge>
        )}
        {repo.pushedAt && (
          <span className="text-xs text-neutral-400">
            Updated {timeAgo(repo.pushedAt)}
          </span>
        )}
      </div>
    </div>
  );
}
