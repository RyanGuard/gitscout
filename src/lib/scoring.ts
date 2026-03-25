// Developer scoring engine — produces normalized 0-100 scores
// Factors: stars, followers, commits, repo quality, language diversity, recency, hireable

import type { GitHubUser, GitHubRepo } from "@/types";
import type { ContributionData } from "@/pipeline/graphql";

interface ScoreInput {
  user: GitHubUser;
  repos: GitHubRepo[];
  contributions: ContributionData | null;
}

interface ScoreOutput {
  score: number;
  totalCommits: number;
  recentActivity: number;
  languageDiversity: number;
  avgRepoQuality: number;
}

// Log-scale normalization: maps 0..infinity to 0..1
// halfPoint is the value that maps to 0.5
function logNorm(value: number, halfPoint: number): number {
  if (value <= 0) return 0;
  return Math.min(1, Math.log(1 + value) / Math.log(1 + halfPoint * 2));
}

export function computeScore({ user, repos, contributions }: ScoreInput): ScoreOutput {
  const nonForkRepos = repos.filter((r) => !r.fork && !r.archived);
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);

  // --- Individual metrics ---

  // Stars: log-scaled, halfPoint=200 (200 stars ≈ 0.5)
  const starsScore = logNorm(totalStars, 200);

  // Followers: log-scaled, halfPoint=100
  const followersScore = logNorm(user.followers, 100);

  // Commit activity (last 12 months)
  const totalCommits = contributions?.totalCommitContributions ?? 0;
  const totalContributions = contributions?.totalContributions ?? 0;
  const commitsScore = logNorm(totalContributions, 500);

  // Repo quality: avg stars per non-fork repo
  const avgStarsPerRepo =
    nonForkRepos.length > 0
      ? totalStars / nonForkRepos.length
      : 0;
  const repoQualityScore = logNorm(avgStarsPerRepo, 20);

  // Language diversity
  const uniqueLanguages = new Set(
    nonForkRepos.map((r) => r.language).filter(Boolean)
  ).size;
  const diversityScore = Math.min(1, uniqueLanguages / 8);

  // Recency: days since last push (lower is better)
  const lastPush = nonForkRepos
    .map((r) => r.pushed_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];
  let recencyScore = 0.2; // default if no push data
  if (lastPush) {
    const daysSincePush =
      (Date.now() - new Date(lastPush).getTime()) / (1000 * 60 * 60 * 24);
    recencyScore =
      daysSincePush <= 7
        ? 1
        : daysSincePush <= 30
          ? 0.8
          : daysSincePush <= 90
            ? 0.6
            : daysSincePush <= 365
              ? 0.3
              : 0.1;
  }

  // Hireable bonus
  const hireableBonus = user.hireable ? 0.05 : 0;

  // --- Weighted composite (sums to 1.0 + bonus) ---
  const raw =
    starsScore * 0.20 +
    followersScore * 0.15 +
    commitsScore * 0.25 +
    repoQualityScore * 0.15 +
    diversityScore * 0.10 +
    recencyScore * 0.10 +
    hireableBonus;

  const score = Math.round(Math.min(100, raw * 100) * 10) / 10;

  return {
    score,
    totalCommits,
    recentActivity: totalContributions,
    languageDiversity: uniqueLanguages,
    avgRepoQuality: Math.round(avgStarsPerRepo * 10) / 10,
  };
}
