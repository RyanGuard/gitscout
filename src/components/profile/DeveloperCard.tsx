import Link from "next/link";
import { MapPin, Star, Users, GitFork, Mail, Clock, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, getLanguageColor, timeAgo } from "@/lib/utils";
import type { DeveloperProfile } from "@/types";

const TIER_STYLES: Record<string, { badge: string; accent: string }> = {
  Elite: {
    badge: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 font-bold",
    accent: "border-l-yellow-500",
  },
  Strong: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    accent: "border-l-blue-500",
  },
  Solid: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    accent: "border-l-emerald-500",
  },
  Emerging: {
    badge: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
    accent: "border-l-neutral-400",
  },
};

interface DeveloperCardProps {
  developer: DeveloperProfile & { tier?: string; source?: string };
}

export function DeveloperCard({ developer }: DeveloperCardProps) {
  const topLanguages = developer.languages.slice(0, 4);
  const devAny = developer as unknown as Record<string, unknown>;
  const tier = devAny.tier as string | undefined;
  const tierStyle = tier ? TIER_STYLES[tier] : undefined;
  const hasEmail = !!developer.email;

  // Find most recently pushed repo for "last active" signal
  const recentRepo = developer.repositories?.[0];
  const lastActive = recentRepo?.pushedAt;

  return (
    <Link
      href={`/profile/${developer.username}`}
      className={`group block rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md hover:-translate-y-0.5 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-blue-600 ${
        tierStyle ? `border-l-4 ${tierStyle.accent}` : ""
      }`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar + Score */}
          <div className="flex flex-col items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={developer.avatarUrl || `https://github.com/${developer.username}.png`}
              alt={developer.username}
              className="h-14 w-14 rounded-full border-2 border-neutral-100 dark:border-neutral-800"
            />
            {developer.score > 0 && (
              <span className={`text-xs font-bold tabular-nums ${
                tier === "Elite" ? "text-yellow-600 dark:text-yellow-400" :
                tier === "Strong" ? "text-blue-600 dark:text-blue-400" :
                "text-neutral-500"
              }`}>
                {developer.score}
              </span>
            )}
          </div>

          {/* Main info */}
          <div className="min-w-0 flex-1">
            {/* Name row */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="truncate text-base font-semibold text-neutral-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                {developer.name || developer.username}
              </h3>
              {tier && tierStyle && (
                <Badge className={tierStyle.badge}>
                  {tier === "Elite" ? "★ " : ""}{tier}
                </Badge>
              )}
              {developer.hireable && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Open to work
                </Badge>
              )}
              {hasEmail && (
                <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  <Mail className="h-3 w-3" /> Email
                </Badge>
              )}
            </div>

            {/* Username + company */}
            <div className="flex items-center gap-3 text-sm text-neutral-500 mt-0.5">
              <span>@{developer.username}</span>
              {developer.company && (
                <span className="flex items-center gap-1 truncate">
                  <Building2 className="h-3 w-3" />
                  {developer.company.replace(/^@/, "")}
                </span>
              )}
            </div>

            {/* Bio */}
            {developer.bio && (
              <p className="mt-1.5 line-clamp-1 text-sm text-neutral-600 dark:text-neutral-400">
                {developer.bio}
              </p>
            )}

            {/* Stats row */}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
              {developer.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {developer.location}
                </span>
              )}
              {developer.followers > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {formatNumber(developer.followers)}
                </span>
              )}
              {developer.totalStars > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {formatNumber(developer.totalStars)}
                </span>
              )}
              {developer.publicRepos > 0 && (
                <span className="flex items-center gap-1">
                  <GitFork className="h-3 w-3" />
                  {developer.publicRepos}
                </span>
              )}
              {lastActive && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeAgo(lastActive)}
                </span>
              )}
            </div>

            {/* Languages */}
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
      </div>
    </Link>
  );
}
