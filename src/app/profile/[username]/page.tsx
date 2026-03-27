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
import { ProfileActions } from "@/components/profile/ProfileActions";
import { ScoreBreakdown } from "@/components/profile/ScoreBreakdown";
import { ScoutingReport } from "@/components/features/ScoutingReport";
import { OutreachDraft } from "@/components/features/OutreachDraft";
import { FindSimilar } from "@/components/features/FindSimilar";
import { ShareCard } from "@/components/features/ShareCard";
import { formatNumber, getLanguageColor } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { GitHubUser, GitHubRepo } from "@/types";

const GITHUB_API = "https://api.github.com";

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Scout/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// Fetch a developer: local DB first, then GitHub live
async function getDeveloper(username: string) {
  // Check local DB first
  const local = await prisma.developer.findUnique({
    where: { username },
    include: {
      languages: { orderBy: { percentage: "desc" } },
      repositories: { orderBy: { stars: "desc" } },
    },
  });

  if (local) {
    return {
      source: "local" as const,
      id: local.id,
      githubId: local.githubId,
      username: local.username,
      name: local.name,
      email: local.email,
      avatarUrl: local.avatarUrl,
      bio: local.bio,
      company: local.company,
      location: local.location,
      blog: local.blog,
      twitterUsername: local.twitterUsername,
      publicRepos: local.publicRepos,
      followers: local.followers,
      following: local.following,
      hireable: local.hireable,
      primaryLanguage: local.primaryLanguage,
      totalCommits: local.totalCommits,
      totalStars: local.totalStars,
      score: local.score,
      languages: local.languages,
      repositories: local.repositories.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.fullName,
        description: r.description,
        language: r.language,
        stars: r.stars,
        forks: r.forks,
        topics: r.topics,
        pushedAt: r.pushedAt?.toISOString() ?? null,
      })),
    };
  }

  // Not in DB — fetch live from GitHub
  const [userRes, reposRes] = await Promise.all([
    fetch(`${GITHUB_API}/users/${username}`, { headers: githubHeaders(), next: { revalidate: 300 } }),
    fetch(`${GITHUB_API}/users/${username}/repos?per_page=20&sort=stars&direction=desc`, { headers: githubHeaders(), next: { revalidate: 300 } }),
  ]);

  if (!userRes.ok) return null;

  const user: GitHubUser = await userRes.json();
  const repos: GitHubRepo[] = reposRes.ok ? await reposRes.json() : [];
  const nonForkRepos = repos.filter((r) => !r.fork && !r.archived);

  // Compute language stats from repos
  const langMap = new Map<string, { count: number; stars: number }>();
  for (const repo of nonForkRepos) {
    if (!repo.language) continue;
    const existing = langMap.get(repo.language) || { count: 0, stars: 0 };
    existing.count++;
    existing.stars += repo.stargazers_count;
    langMap.set(repo.language, existing);
  }
  const totalWeight = Array.from(langMap.values()).reduce((s, v) => s + v.stars + v.count, 0);
  const languages = Array.from(langMap.entries())
    .map(([language, { count, stars }]) => ({
      language,
      bytes: stars * 1000 + count * 1000,
      repoCount: count,
      percentage: totalWeight > 0 ? ((stars + count) / totalWeight) * 100 : 0,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);

  return {
    source: "github" as const,
    id: `gh-${user.id}`,
    githubId: user.id,
    username: user.login,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    company: user.company,
    location: user.location,
    blog: user.blog,
    twitterUsername: user.twitter_username,
    publicRepos: user.public_repos,
    followers: user.followers,
    following: user.following,
    hireable: user.hireable ?? false,
    primaryLanguage: languages[0]?.language ?? null,
    totalCommits: 0,
    totalStars: totalStars,
    score: 0,
    languages,
    repositories: nonForkRepos.slice(0, 20).map((r) => ({
      id: String(r.id),
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      topics: r.topics,
      pushedAt: r.pushed_at,
    })),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;

  const developer = await getDeveloper(username);

  if (!developer) {
    return {
      title: "Developer Not Found — Scout",
      description: "This developer profile could not be found on Scout.",
    };
  }

  const displayName = developer.name || developer.username;
  const title = `${displayName} (@${developer.username}) — Scout`;
  const description =
    developer.bio || `Developer profile for ${developer.username} on Scout`;
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
  const developer = await getDeveloper(username);

  if (!developer) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Link
        href="/search"
        className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        &larr; Back to search
      </Link>

      {/* Source badge */}
      {developer.source === "github" && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          Live from GitHub — this developer hasn&apos;t been indexed yet. Data may be limited.
        </div>
      )}

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
              {developer.score > 0 && (
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Score: {developer.score}
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

            {/* Action toolbar — all key actions in one row */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <a
                href={`https://github.com/${developer.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                GitHub <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <ProfileActions
                developerId={developer.id}
                username={developer.username}
                isLocal={developer.source === "local"}
              />
              <FindSimilar
                username={developer.username}
                displayName={developer.name || developer.username}
              />
              <ShareCard
                username={developer.username}
                displayName={developer.name || developer.username}
                score={developer.score}
              />
            </div>
          </div>
        </div>
      </div>

      {/* AI Actions — Scouting Report + Outreach Draft */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ScoutingReport
          username={developer.username}
          profileData={{
            name: developer.name,
            bio: developer.bio,
            location: developer.location,
            company: developer.company,
            followers: developer.followers,
            totalStars: developer.totalStars,
            publicRepos: developer.publicRepos,
            hireable: developer.hireable,
            languages: developer.languages.map((l) => ({
              language: l.language,
              percentage: l.percentage,
            })),
            repositories: developer.repositories.map((r) => ({
              name: r.name,
              stars: r.stars,
              language: r.language,
              description: r.description,
            })),
          }}
        />
        <OutreachDraft
          username={developer.username}
          profileData={{
            name: developer.name,
            bio: developer.bio,
            location: developer.location,
            company: developer.company,
            followers: developer.followers,
            totalStars: developer.totalStars,
            publicRepos: developer.publicRepos,
            languages: developer.languages.map((l) => ({
              language: l.language,
              percentage: l.percentage,
            })),
            repositories: developer.repositories.map((r) => ({
              name: r.name,
              stars: r.stars,
              language: r.language,
              description: r.description,
            })),
          }}
        />
      </div>

      {/* Score Breakdown — loads async, shows 5-pillar analysis */}
      <div className="mt-6">
        <ScoreBreakdown username={developer.username} />
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
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        </div>
      )}

      {/* (AI features and Find Similar / Share Card are in the header toolbar above) */}
    </div>
  );
}
