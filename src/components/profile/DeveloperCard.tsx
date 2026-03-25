"use client";

import Link from "next/link";
import { MapPin, Star, Users, GitFork, Mail, Clock, Building2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { TierBadge, getTierInfo } from "@/components/ui/TierBadge";
import { formatNumber, getLanguageColor, timeAgo } from "@/lib/utils";
import { markProfileViewed, isProfileViewed } from "@/lib/viewedProfiles";
import { useState, useEffect } from "react";
import type { DeveloperProfile } from "@/types";

const SCORE_ACCENTS: Record<string, string> = {
  Unicorn: "border-l-violet-500",
  "On Fire": "border-l-amber-500",
  Gem: "border-l-blue-500",
  Seedling: "border-l-emerald-500",
};

interface DeveloperCardProps {
  developer: DeveloperProfile & { tier?: string; source?: string };
}

export function DeveloperCard({ developer }: DeveloperCardProps) {
  const topLanguages = developer.languages.slice(0, 4);
  const tierInfo = developer.score > 0 ? getTierInfo(developer.score) : null;
  const tierAccent = tierInfo ? SCORE_ACCENTS[tierInfo.label] : undefined;
  const hasEmail = !!developer.email;
  const [viewed, setViewed] = useState(false);

  useEffect(() => {
    setViewed(isProfileViewed(developer.username));
  }, [developer.username]);

  function handleClick() {
    markProfileViewed(developer.username);
    setViewed(true);
  }

  // Find most recently pushed repo for "last active" signal
  const recentRepo = developer.repositories?.[0];
  const lastActive = recentRepo?.pushedAt;

  return (
    <Link
      href={`/profile/${developer.username}`}
      onClick={handleClick}
      className={`group block rounded-xl border border-neutral-200/50 bg-white shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 dark:border-neutral-800/80 dark:bg-neutral-900/60 dark:hover:border-indigo-500/40 dark:hover:shadow-indigo-500/5 ${
        tierAccent ? `border-l-4 ${tierAccent}` : ""
      } ${viewed ? "opacity-60" : ""}`}
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
                tierInfo ? tierInfo.color : "text-neutral-500"
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
              {developer.score > 0 && (
                <TierBadge score={developer.score} size="sm" />
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
              {viewed && (
                <Badge className="bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500">
                  <Eye className="h-3 w-3" /> Viewed
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
