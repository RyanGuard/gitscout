import Link from "next/link";
import { MapPin, Star, GitFork, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, getLanguageColor } from "@/lib/utils";
import type { DeveloperProfile } from "@/types";

interface MatchCardProps {
  developer: DeveloperProfile;
  fitScore: number;
  matchedLanguages: string[];
  matchedSkills: string[];
  locationMatch: boolean;
  reasons: string[];
}

function getFitColor(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 40) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

export function MatchCard({
  developer,
  fitScore,
  matchedLanguages,
  matchedSkills,
  locationMatch,
  reasons,
}: MatchCardProps) {
  const topLanguages = developer.languages.slice(0, 5);
  const matchedLangsLower = new Set(matchedLanguages.map((l) => l.toLowerCase()));

  return (
    <Link
      href={`/profile/${developer.username}`}
      className="group block rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-gold/30 hover:shadow-md hover:-translate-y-0.5 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-gold"
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
            <h3 className="truncate text-lg font-semibold text-neutral-900 group-hover:text-gold dark:text-white dark:group-hover:text-gold">
              {developer.name || developer.username}
            </h3>
            <Badge className={getFitColor(fitScore)}>
              {fitScore}% fit
            </Badge>
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
              <span className={`flex items-center gap-1 ${locationMatch ? "text-green-600 dark:text-green-400" : ""}`}>
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

          {/* Languages with match highlighting */}
          {topLanguages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {topLanguages.map((lang) => {
                const isMatched = matchedLangsLower.has(lang.language.toLowerCase());
                return (
                  <Badge
                    key={lang.language}
                    color={getLanguageColor(lang.language)}
                    className={isMatched ? "ring-2 ring-green-400 dark:ring-green-600" : ""}
                  >
                    {lang.language}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Match reasons */}
          {reasons.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {reasons.map((reason) => (
                <span
                  key={reason}
                  className="inline-flex items-center rounded-md bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                >
                  {reason}
                </span>
              ))}
            </div>
          )}

          {/* Matched skills */}
          {matchedSkills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {matchedSkills.map((skill) => (
                <Badge
                  key={skill}
                  className="bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
