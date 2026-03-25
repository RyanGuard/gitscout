// GitScout Developer Scoring Engine — 5 Pillar Framework
// Based on: docs/SCORING_FRAMEWORK.md
//
// Pillars:
//   1. IMPACT (30%)        — Stars, forks, sponsorship
//   2. CONTRIBUTION (25%)  — Merged PRs to external repos (#1 signal), PR reviews
//   3. CONSISTENCY (20%)   — Calendar analysis, streaks, recency
//   4. TECHNICAL (15%)     — Language diversity, repo complexity
//   5. REPUTATION (10%)    — Followers, follower ratio, hireable
//
// Produces: 0-100 score × confidence modifier (0.5-1.0)
// Score tiers: Elite (90+), Strong (75-89), Solid (60-74), Emerging (40-59), Limited (<40)

import type { GitHubUser, GitHubRepo } from "@/types";
import type { ContributionData } from "@/pipeline/graphql";

export interface ScoreInput {
  user: GitHubUser;
  repos: GitHubRepo[];
  contributions: ContributionData | null;
}

export interface ScoreOutput {
  score: number;
  tier: string;
  confidence: string;
  confidenceValue: number;
  totalCommits: number;
  recentActivity: number;
  languageDiversity: number;
  avgRepoQuality: number;
  externalMergedPRs: number;
  // Pillar breakdowns (0-10 each)
  impactScore: number;
  contributionScore: number;
  consistencyScore: number;
  technicalScore: number;
  reputationScore: number;
}

// Log-scale: maps 0..infinity to 0..10
// halfPoint = value that maps to 5
function logScale(value: number, halfPoint: number): number {
  if (value <= 0) return 0;
  return Math.min(10, (Math.log(1 + value) / Math.log(1 + halfPoint)) * 5);
}

// Tiered scoring: specific thresholds map to specific point values
function tieredScore(value: number, tiers: [number, number][]): number {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (value >= tiers[i][0]) return tiers[i][1];
  }
  return 0;
}

// ═══════════════════════════════════════════════════════
// PILLAR 1: IMPACT (30%) — Does their code matter to others?
// ═══════════════════════════════════════════════════════
function scoreImpact(repos: GitHubRepo[], contributions: ContributionData | null): number {
  const nonFork = repos.filter((r) => !r.fork && !r.archived);

  // Stars — capped per repo at 40% of pillar to prevent single-repo inflation
  const maxSingleRepoContribution = 4; // 40% of 10
  let starsScore = 0;
  for (const repo of nonFork) {
    const repoStarScore = tieredScore(repo.stargazers_count, [
      [1, 0.5], [10, 1], [100, 2], [500, 3], [1000, 4],
      [5000, 5], [10000, 6],
    ]);
    starsScore += Math.min(repoStarScore, maxSingleRepoContribution);
  }
  starsScore = Math.min(10, starsScore); // Normalize

  // Forks — weighted at 60% of stars (noisier signal)
  const totalForks = nonFork.reduce((s, r) => s + r.forks_count, 0);
  const forksScore = logScale(totalForks, 100) * 0.6;

  // Sponsorship bonus
  const sponsorBonus = (contributions?.isSponsorable && contributions.sponsorCount > 0) ? 1.5 : 0;

  return Math.min(10, starsScore * 0.55 + forksScore * 0.35 + sponsorBonus);
}

// ═══════════════════════════════════════════════════════
// PILLAR 2: CONTRIBUTION QUALITY (25%) — The #1 signal
// ═══════════════════════════════════════════════════════
function scoreContribution(contributions: ContributionData | null): number {
  if (!contributions) return 0;

  // Merged PRs to external repos — THE gold standard
  // This is peer-validated code. You can't fake it.
  const externalPRs = tieredScore(contributions.externalMergedPRs, [
    [1, 2], [5, 4], [10, 5.5], [20, 7], [50, 8.5], [100, 9.5], [200, 10],
  ]);

  // PR review activity — shows senior-level collaboration
  const reviewScore = tieredScore(contributions.totalPullRequestReviewContributions, [
    [1, 0.5], [5, 1], [10, 1.5], [25, 2], [50, 2.5],
  ]);

  // Total PRs opened (own + external)
  const prVolume = tieredScore(contributions.totalPullRequestContributions, [
    [1, 0.3], [5, 0.5], [10, 0.8], [25, 1],
  ]);

  // External PRs dominate this pillar (70% weight)
  return Math.min(10, externalPRs * 0.7 + reviewScore * 0.2 + prVolume * 0.1);
}

// ═══════════════════════════════════════════════════════
// PILLAR 3: CONSISTENCY & ACTIVITY (20%)
// ═══════════════════════════════════════════════════════
function scoreConsistency(
  repos: GitHubRepo[],
  contributions: ContributionData | null
): number {
  // Total contributions (last 12 months)
  const totalContribs = contributions?.totalContributions ?? 0;
  const volumeScore = tieredScore(totalContribs, [
    [10, 1], [50, 2.5], [100, 4], [200, 5.5], [500, 7], [1000, 8.5], [2000, 10],
  ]);

  // Weekly consistency — what % of weeks had activity
  const consistency = contributions?.consistencyRatio ?? 0;
  const consistencyScore = consistency * 10; // 0-10 linear

  // Recency — active in last 90 days?
  const nonFork = repos.filter((r) => !r.fork && !r.archived);
  const lastPush = nonFork
    .map((r) => r.pushed_at)
    .filter(Boolean)
    .sort()
    .reverse()[0];

  let recencyScore = 1;
  if (lastPush) {
    const days = (Date.now() - new Date(lastPush).getTime()) / (1000 * 60 * 60 * 24);
    recencyScore = days <= 14 ? 10 : days <= 30 ? 8 : days <= 90 ? 6 : days <= 180 ? 3 : 1;
  }

  return Math.min(10, volumeScore * 0.4 + consistencyScore * 0.35 + recencyScore * 0.25);
}

// ═══════════════════════════════════════════════════════
// PILLAR 4: TECHNICAL DEPTH (15%)
// ═══════════════════════════════════════════════════════
function scoreTechnical(repos: GitHubRepo[]): number {
  const nonFork = repos.filter((r) => !r.fork && !r.archived);

  // Language diversity
  const languages = new Set(nonFork.map((r) => r.language).filter(Boolean));
  const diversityScore =
    languages.size <= 1 ? 3   // Specialist — neutral
    : languages.size <= 3 ? 5
    : languages.size <= 5 ? 7  // Well-rounded
    : languages.size <= 8 ? 8.5
    : 9;                       // Polyglot

  // Repo complexity — larger repos with descriptions and topics
  let complexityPoints = 0;
  for (const repo of nonFork.slice(0, 20)) {
    if (repo.description && repo.description.length > 20) complexityPoints += 0.3;
    if (repo.topics && repo.topics.length > 0) complexityPoints += 0.4;
    if (repo.stargazers_count > 10) complexityPoints += 0.3;
  }
  const complexityScore = Math.min(10, complexityPoints);

  // Number of substantial repos (not trivial)
  const substantialRepos = nonFork.filter(
    (r) => r.stargazers_count > 0 || (r.description && r.description.length > 10)
  ).length;
  const depthScore = tieredScore(substantialRepos, [
    [1, 2], [3, 4], [5, 5.5], [10, 7], [20, 8.5], [30, 10],
  ]);

  return Math.min(10, diversityScore * 0.35 + complexityScore * 0.3 + depthScore * 0.35);
}

// ═══════════════════════════════════════════════════════
// PILLAR 5: REPUTATION & SOCIAL PROOF (10%)
// ═══════════════════════════════════════════════════════
function scoreReputation(user: GitHubUser): number {
  // Followers — log scale
  const followerScore = tieredScore(user.followers, [
    [5, 1], [10, 2], [50, 4], [200, 6], [500, 7.5], [1000, 8.5], [5000, 9.5], [10000, 10],
  ]);

  // Follower/following ratio — thought leader signal
  const ratio = user.following > 0 ? user.followers / user.following : user.followers;
  const ratioScore =
    ratio >= 10 ? 3
    : ratio >= 5 ? 2.5
    : ratio >= 2 ? 2
    : ratio >= 1 ? 1
    : 0;

  // Hireable + profile completeness
  let profileScore = 0;
  if (user.hireable) profileScore += 1;
  if (user.email) profileScore += 0.5;
  if (user.bio) profileScore += 0.5;
  if (user.blog) profileScore += 0.3;
  if (user.twitter_username) profileScore += 0.2;

  return Math.min(10, followerScore * 0.6 + ratioScore * 0.25 + profileScore * 0.15);
}

// ═══════════════════════════════════════════════════════
// CONFIDENCE MODIFIER (0.5 — 1.0)
// ═══════════════════════════════════════════════════════
function computeConfidence(
  repos: GitHubRepo[],
  contributions: ContributionData | null
): { value: number; label: string } {
  const nonFork = repos.filter((r) => !r.fork && !r.archived);
  const totalContribs = contributions?.totalContributions ?? 0;
  const hasRecentActivity = contributions?.consistencyRatio
    ? contributions.consistencyRatio > 0.1
    : false;

  if (nonFork.length >= 10 && totalContribs >= 200 && hasRecentActivity) {
    return { value: 1.0, label: "high" };
  }
  if (nonFork.length >= 5 && totalContribs >= 50) {
    return { value: 0.75, label: "medium" };
  }
  return { value: 0.5, label: "low" };
}

// ═══════════════════════════════════════════════════════
// SCORE TIERS
// ═══════════════════════════════════════════════════════
function getTier(score: number): string {
  if (score >= 90) return "Elite";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Emerging";
  return "Limited Data";
}

// ═══════════════════════════════════════════════════════
// MAIN SCORING FUNCTION
// ═══════════════════════════════════════════════════════
export function computeScore({ user, repos, contributions }: ScoreInput): ScoreOutput {
  const nonForkRepos = repos.filter((r) => !r.fork && !r.archived);

  // Compute each pillar (0-10 scale)
  const impact = scoreImpact(repos, contributions);
  const contribution = scoreContribution(contributions);
  const consistency = scoreConsistency(repos, contributions);
  const technical = scoreTechnical(repos);
  const reputation = scoreReputation(user);

  // Weighted composite → 0-10
  const rawComposite =
    impact * 0.30 +
    contribution * 0.25 +
    consistency * 0.20 +
    technical * 0.15 +
    reputation * 0.10;

  // Scale to 0-100 and apply confidence modifier
  const confidence = computeConfidence(repos, contributions);
  const rawScore = rawComposite * 10; // 0-100
  const score = Math.round(rawScore * confidence.value * 10) / 10;

  // Compute derivative metrics for DB storage
  const totalStars = nonForkRepos.reduce((s, r) => s + r.stargazers_count, 0);
  const uniqueLanguages = new Set(
    nonForkRepos.map((r) => r.language).filter(Boolean)
  ).size;
  const avgStarsPerRepo = nonForkRepos.length > 0 ? totalStars / nonForkRepos.length : 0;

  return {
    score,
    tier: getTier(score),
    confidence: confidence.label,
    confidenceValue: confidence.value,
    totalCommits: contributions?.totalCommitContributions ?? 0,
    recentActivity: contributions?.totalContributions ?? 0,
    languageDiversity: uniqueLanguages,
    avgRepoQuality: Math.round(avgStarsPerRepo * 10) / 10,
    externalMergedPRs: contributions?.externalMergedPRs ?? 0,
    // Pillar breakdowns
    impactScore: Math.round(impact * 10) / 10,
    contributionScore: Math.round(contribution * 10) / 10,
    consistencyScore: Math.round(consistency * 10) / 10,
    technicalScore: Math.round(technical * 10) / 10,
    reputationScore: Math.round(reputation * 10) / 10,
  };
}
