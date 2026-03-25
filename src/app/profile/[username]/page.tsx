import type { Metadata } from "next";
import {
  MapPin,
  Building2,
  Link as LinkIcon,
  AtSign,
  Mail,
  Star,
  Users,
  GitFork,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { LanguageBar } from "@/components/profile/LanguageBar";
import { RepoCard } from "@/components/profile/RepoCard";
import { formatNumber } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

  const developer = await prisma.developer.findUnique({
    where: { username },
    select: { name: true, username: true, bio: true, avatarUrl: true },
  });

  if (!developer) {
    return {
      title: "Developer Not Found — GitScout",
      description: "This developer profile could not be found on GitScout.",
    };
  }

  const displayName = developer.name || developer.username;
  const title = `${displayName} (@${developer.username}) — GitScout`;
  const description =
    developer.bio || `Developer profile for ${developer.username} on GitScout`;
  const avatarUrl =
    developer.avatarUrl || `https://github.com/${developer.username}.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: avatarUrl }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: [avatarUrl],
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const developer = await prisma.developer.findUnique({
    where: { username },
    include: {
      languages: { orderBy: { percentage: "desc" } },
      repositories: { orderBy: { stars: "desc" } },
    },
  });

  if (!developer) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link
        href="/search"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        &larr; Back to search
      </Link>

      {/* Profile header */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={developer.avatarUrl || `https://github.com/${developer.username}.png`}
            alt={developer.username}
            className="h-28 w-28 rounded-full border-4 border-neutral-100 dark:border-neutral-800"
          />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
                {developer.name || developer.username}
              </h1>
              {developer.hireable && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Hireable
                </Badge>
              )}
            </div>
            <p className="text-neutral-500">@{developer.username}</p>

            {developer.bio && (
              <p className="mt-2 text-neutral-700 dark:text-neutral-300">
                {developer.bio}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              {developer.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" /> {developer.location}
                </span>
              )}
              {developer.company && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-4 w-4" /> {developer.company}
                </span>
              )}
              {developer.blog && (
                <a
                  href={
                    developer.blog.startsWith("http")
                      ? developer.blog
                      : `https://${developer.blog}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  <LinkIcon className="h-4 w-4" /> Website
                </a>
              )}
              {developer.twitterUsername && (
                <a
                  href={`https://twitter.com/${developer.twitterUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-blue-600"
                >
                  <AtSign className="h-4 w-4" /> @{developer.twitterUsername}
                </a>
              )}
              {developer.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" /> {developer.email}
                </span>
              )}
            </div>

            <div className="mt-4 flex gap-6 text-sm">
              <span className="flex items-center gap-1 font-medium">
                <Star className="h-4 w-4 text-yellow-500" />
                {formatNumber(developer.totalStars)} stars
              </span>
              <span className="flex items-center gap-1 font-medium">
                <Users className="h-4 w-4 text-blue-500" />
                {formatNumber(developer.followers)} followers
              </span>
              <span className="flex items-center gap-1 font-medium">
                <GitFork className="h-4 w-4 text-purple-500" />
                {developer.publicRepos} repos
              </span>
            </div>

            <a
              href={`https://github.com/${developer.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              View on GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Languages */}
      {developer.languages.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            Languages
          </h2>
          <LanguageBar languages={developer.languages} />
        </div>
      )}

      {/* Repositories */}
      {developer.repositories.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-4 text-lg font-semibold text-neutral-900 dark:text-white">
            Top Repositories
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {developer.repositories.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={{
                  ...repo,
                  pushedAt: repo.pushedAt?.toISOString() ?? null,
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
