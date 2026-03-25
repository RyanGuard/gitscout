import Link from "next/link";
import { MapPin, Star, GitFork, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, getLanguageColor } from "@/lib/utils";
import type { DeveloperProfile } from "@/types";

interface DeveloperCardProps {
  developer: DeveloperProfile;
}

export function DeveloperCard({ developer }: DeveloperCardProps) {
  const topLanguages = developer.languages.slice(0, 3);

  return (
    <Link
      href={`/profile/${developer.username}`}
      className="group block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-blue-600"
    >
      <div className="flex items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={developer.avatarUrl || `https://github.com/${developer.username}.png`}
          alt={developer.username}
          className="h-14 w-14 rounded-full border-2 border-neutral-100 dark:border-neutral-800"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-neutral-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
              {developer.name || developer.username}
            </h3>
            {developer.hireable && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Hireable
              </Badge>
            )}
          </div>
          <p className="text-sm text-neutral-500">@{developer.username}</p>
          {developer.bio && (
            <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
              {developer.bio}
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
            {developer.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {developer.location}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              {formatNumber(developer.totalStars)}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="h-3.5 w-3.5" />
              {developer.publicRepos} repos
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {formatNumber(developer.followers)}
            </span>
          </div>

          {topLanguages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topLanguages.map((lang) => (
                <Badge key={lang.language} color={getLanguageColor(lang.language)}>
                  {lang.language}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
