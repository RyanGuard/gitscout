import type { GitHubUser, GitHubRepo } from "@/types";
import type { ContributionData } from "@/pipeline/graphql";

export interface ScoreInput {
  user: GitHubUser;
  repos: GitHubRepo[];
  contributions: ContributionData | null;
}

export interface ScoreResult {
  score: number;
  totalCommits: number;
  recentActivity: number;
  languageDiversity: number;
  avgRepoQuality: number;
}

/**
 * Computes a developer score from 0-100 using weighted sub-scores:
 *
 *   Stars (20%)           - log-scaled total stars across non-fork repos
 *   Followers (15%)       - log-scaled follower count
 *   Commit activity (25%) - commits in last 12 months (from GraphQL)
 *   Repo quality (15%)    - average stars per non-fork repo
 *   Language diversity (10%) - number of distinct languages
 *   Recency (10%)         - how recently the user pushed code
 *   Hireable bonus (5%)   - boolean bump
 */
export function computeScore(input: ScoreInput): ScoreResult {
  const { user, repos, contributions } = input;
  const nonForkRepos = repos.filter((r) => !r.fork && !r.archived);

  // --- Sub-score: Stars (0-100, log scale) ---
  const totalStars = nonForkRepos.reduce((s, r) => s + r.stargazers_count, 0);
  // log2(1 + stars) / log2(1 + 10000) maps 10k stars to 1.0
  const starsScore = Math.min(
    100,
    (Math.log2(1 + totalStars) / Math.log2(1 + 10000)) * 100
  );

  // --- Sub-score: Followers (0-100, log scale) ---
  // log2(1 + followers) / log2(1 + 5000) maps 5k followers to 1.0
  const followersScore = Math.min(
    100,
    (Math.log2(1 + user.followers) / Math.log2(1 + 5000)) * 100
  );

  // --- Sub-score: Commit activity (0-100) ---
  const totalCommits = contributions
    ? contributions.totalCommitContributions +
      contributions.restrictedContributionsCount
    : 0;
  const recentActivity = contributions
    ? contributions.totalContributions
    : 0;
  // 500+ commits/year is very active -> 100
  const commitScore = Math.min(100, (totalCommits / 500) * 100);

  // --- Sub-score: Repo quality (0-100) ---
  // Average stars per non-fork repo, scaled so 50 avg stars = 100
  const avgRepoQuality =
    nonForkRepos.length > 0
      ? nonForkRepos.reduce((s, r) => s + r.stargazers_count, 0) /
        nonForkRepos.length
      : 0;
  const repoQualityScore = Math.min(100, (avgRepoQuality / 50) * 100);

  // --- Sub-score: Language diversity (0-100) ---
  const languages = new Set(
    nonForkRepos.map((r) => r.language).filter(Boolean)
  );
  const languageDiversity = languages.size;
  // 8+ languages = max score
  const langDiversityScore = Math.min(100, (languageDiversity / 8) * 100);

  // --- Sub-score: Recency (0-100) ---
  const now = Date.now();
  const pushDates = nonForkRepos
    .map((r) => (r.pushed_at ? new Date(r.pushed_at).getTime() : 0))
    .filter((t) => t > 0);
  let recencyScore = 0;
  if (pushDates.length > 0) {
    const mostRecent = Math.max(...pushDates);
    const daysSincePush = (now - mostRecent) / (1000 * 60 * 60 * 24);
    // Active within 7 days = 100, decays to 0 at ~365 days
    recencyScore = Math.max(0, Math.min(100, 100 - (daysSincePush / 365) * 100));
  }

  // --- Sub-score: Hireable (0 or 100) ---
  const hireableScore = user.hireable ? 100 : 0;

  // --- Weighted total ---
  const score =
    starsScore * 0.2 +
    followersScore * 0.15 +
    commitScore * 0.25 +
    repoQualityScore * 0.15 +
    langDiversityScore * 0.1 +
    recencyScore * 0.1 +
    hireableScore * 0.05;

  return {
    score: Math.round(score * 100) / 100,
    totalCommits,
    recentActivity,
    languageDiversity,
    avgRepoQuality: Math.round(avgRepoQuality * 100) / 100,
  };
}
