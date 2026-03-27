// Scout Scoring Engine V2 — 5 Pillar Framework
// Exact weights and thresholds from docs/SCORING_FRAMEWORK.md
// Impact (30%) | Contribution Quality (25%) | Consistency (20%) | Technical Depth (15%) | Reputation (10%)

export interface ScoringInput {
  // User profile
  followers: number;
  following: number;
  publicRepos: number;
  accountCreatedAt: string;
  hireable: boolean;
  bio: string;

  // Repos
  repos: Array<{
    name: string;
    stars: number;
    forks: number;
    language: string;
    isFork: boolean;
    updatedAt: string;
    description?: string;
    topics?: string[];
  }>;

  // Contributions (from GraphQL)
  totalContributions: number;
  totalCommits: number;
  totalPRs: number;
  totalReviews: number;
  totalIssues: number;
  contributionDays: Array<{ date: string; count: number }>;

  // Deep search context
  externalMergedPRs: number;
  seedRepoContributions: Array<{ repo: string; weight: number; commits: number }>;
  organizations: string[];

  // Search context (for language matching)
  targetLanguage?: string;
  targetRole?: string;

  // Sponsorship
  isSponsorable?: boolean;
  sponsorCount?: number;
}

export interface ScoreResult {
  total: number;
  impact: number;
  contributionQuality: number;
  consistency: number;
  technicalDepth: number;
  reputation: number;
  confidence: "high" | "medium" | "low";
  confidenceModifier: number;
  tier: { emoji: string; label: string; color: string };
  breakdown: Record<string, { score: number; maxScore: number; signal: string }>;
}

// ─── Tiered scoring helper ───
function tiered(value: number, tiers: [number, number][]): number {
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (value >= tiers[i][0]) return tiers[i][1];
  }
  return 0;
}

// ─── Notable orgs ───
const NOTABLE_ORGS = new Set([
  "google", "facebook", "meta", "microsoft", "apple", "amazon", "netflix",
  "stripe", "vercel", "supabase", "hashicorp", "docker", "kubernetes",
  "rust-lang", "golang", "python", "nodejs", "github", "gitlab",
  "cloudflare", "shopify", "uber", "airbnb", "twitter", "x",
  "datadog", "elastic", "confluent", "databricks", "openai",
]);

// ═══ PILLAR 1: IMPACT (30%) ═══
function scoreImpact(input: ScoringInput): { score: number; breakdown: Record<string, { score: number; maxScore: number; signal: string }> } {
  const ownedRepos = input.repos.filter((r) => !r.isFork);

  // Stars — capped per repo at 40%
  let totalStarPoints = 0;
  for (const repo of ownedRepos) {
    const repoPoints = tiered(repo.stars, [
      [1, 1], [10, 3], [100, 5], [500, 7], [1000, 8], [5000, 10],
    ]);
    totalStarPoints += Math.min(repoPoints, 4); // Cap at 40% of 10
  }
  const starsScore = Math.min(10, totalStarPoints);

  // Forks — same scale × 0.6
  const totalForks = ownedRepos.reduce((s, r) => s + r.forks, 0);
  const forksScore = tiered(totalForks, [
    [1, 1], [10, 3], [50, 5], [200, 7], [500, 8], [1000, 10],
  ]) * 0.6;

  // Sponsorship bonus
  const sponsorBonus = (input.isSponsorable && (input.sponsorCount ?? 0) > 0) ? 2 : 0;

  const raw = Math.min(10, starsScore * 0.5 + forksScore * 0.3 + sponsorBonus * 0.2);
  const normalized = Math.round(raw * 10); // 0-100

  return {
    score: normalized,
    breakdown: {
      stars: { score: Math.round(starsScore * 10), maxScore: 100, signal: `${ownedRepos.reduce((s, r) => s + r.stars, 0)} total stars across ${ownedRepos.length} repos` },
      forks: { score: Math.round(forksScore * 10 / 0.6), maxScore: 100, signal: `${totalForks} total forks` },
      sponsorship: { score: sponsorBonus > 0 ? 100 : 0, maxScore: 100, signal: sponsorBonus > 0 ? "Receives GitHub Sponsors" : "Not sponsored" },
    },
  };
}

// ═══ PILLAR 2: CONTRIBUTION QUALITY (25%) ═══
function scoreContribution(input: ScoringInput): { score: number; breakdown: Record<string, { score: number; maxScore: number; signal: string }> } {
  // External merged PRs — THE #1 SIGNAL
  const externalPRScore = tiered(input.externalMergedPRs, [
    [1, 3], [6, 6], [21, 8], [50, 10],
  ]);

  // Seed repo contributions (weighted)
  let seedScore = 0;
  for (const contrib of input.seedRepoContributions) {
    seedScore += contrib.weight * Math.min(contrib.commits, 5);
  }
  seedScore = Math.min(10, seedScore / 3);

  // PR reviews
  const reviewScore = input.totalReviews >= 10 ? 2 : input.totalReviews >= 5 ? 1 : 0;

  // Total PRs
  const prVolume = input.totalPRs >= 100 ? 3 : input.totalPRs >= 50 ? 2 : input.totalPRs >= 10 ? 1 : 0;

  const raw = Math.min(10, externalPRScore * 0.5 + seedScore * 0.25 + reviewScore + prVolume * 0.1);
  const normalized = Math.round(raw * 10);

  return {
    score: normalized,
    breakdown: {
      externalPRs: { score: externalPRScore * 10, maxScore: 100, signal: `${input.externalMergedPRs} merged PRs to external repos` },
      seedRepos: { score: Math.round(seedScore * 10), maxScore: 100, signal: `Contributes to ${input.seedRepoContributions.length} notable repos` },
      reviews: { score: reviewScore * 50, maxScore: 100, signal: `${input.totalReviews} PR reviews` },
    },
  };
}

// ═══ PILLAR 3: CONSISTENCY (20%) ═══
function scoreConsistency(input: ScoringInput): { score: number; breakdown: Record<string, { score: number; maxScore: number; signal: string }> } {
  // Total contributions
  const volumeScore = tiered(input.totalContributions, [
    [10, 1], [50, 3], [200, 6], [500, 8], [1000, 10],
  ]);

  // Active weeks
  const weekSet = new Set<string>();
  for (const day of input.contributionDays) {
    if (day.count > 0) {
      const d = new Date(day.date);
      const weekKey = `${d.getFullYear()}-W${Math.ceil((d.getDate() + new Date(d.getFullYear(), d.getMonth(), 1).getDay()) / 7)}`;
      weekSet.add(weekKey);
    }
  }
  const activeWeeks = weekSet.size;
  const weeksScore = tiered(activeWeeks, [
    [1, 1], [13, 3], [26, 6], [40, 10],
  ]);

  // Recency
  const recentDays = input.contributionDays
    .filter((d) => d.count > 0)
    .map((d) => (Date.now() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24))
    .sort((a, b) => a - b);
  const mostRecentDay = recentDays[0] ?? 999;
  const recencyBonus = mostRecentDay <= 30 ? 2 : mostRecentDay <= 90 ? 1 : 0;

  const raw = Math.min(10, volumeScore * 0.4 + weeksScore * 0.4 + recencyBonus);
  const normalized = Math.round(raw * 10);

  return {
    score: normalized,
    breakdown: {
      volume: { score: volumeScore * 10, maxScore: 100, signal: `${input.totalContributions} contributions last year` },
      consistency: { score: weeksScore * 10, maxScore: 100, signal: `Active ${activeWeeks} weeks out of 52` },
      recency: { score: recencyBonus * 50, maxScore: 100, signal: mostRecentDay <= 30 ? "Active in last 30 days" : mostRecentDay <= 90 ? "Active in last 90 days" : "Inactive recently" },
    },
  };
}

// ═══ PILLAR 4: TECHNICAL DEPTH (15%) ═══
function scoreTechnical(input: ScoringInput): { score: number; breakdown: Record<string, { score: number; maxScore: number; signal: string }> } {
  const ownedRepos = input.repos.filter((r) => !r.isFork);

  // Language match
  let langMatchScore = 0;
  if (input.targetLanguage) {
    const target = input.targetLanguage.toLowerCase();
    const primary = ownedRepos[0]?.language?.toLowerCase();
    const allLangs = ownedRepos.map((r) => r.language?.toLowerCase()).filter(Boolean);
    const topLangs = allLangs.slice(0, 3);

    if (primary === target) langMatchScore = 10;
    else if (topLangs.includes(target)) langMatchScore = 7;
    else if (allLangs.includes(target)) langMatchScore = 4;
  } else {
    langMatchScore = 5; // Neutral when no target
  }

  // Language diversity
  const uniqueLangs = new Set(ownedRepos.map((r) => r.language).filter(Boolean)).size;
  const diversityScore =
    uniqueLangs <= 1 ? 0
    : uniqueLangs <= 3 ? 2
    : uniqueLangs <= 6 ? 3
    : 2; // 7+ might be unfocused

  // Repo quality
  const hasStarredRepos = ownedRepos.some((r) => r.stars >= 100);
  const hasDescriptions = ownedRepos.filter((r) => r.description && r.description.length > 10).length;
  const qualityScore = (hasStarredRepos ? 2 : 0) + (hasDescriptions >= 5 ? 1 : 0);

  const raw = Math.min(10, langMatchScore * 0.5 + diversityScore + qualityScore);
  const normalized = Math.round(raw * 10);

  return {
    score: normalized,
    breakdown: {
      languageMatch: { score: langMatchScore * 10, maxScore: 100, signal: input.targetLanguage ? `Target: ${input.targetLanguage}` : "No target language" },
      diversity: { score: diversityScore * 33, maxScore: 100, signal: `${uniqueLangs} languages across repos` },
      quality: { score: qualityScore * 33, maxScore: 100, signal: `${hasStarredRepos ? "Has 100+ star repos" : "No breakout repos"}` },
    },
  };
}

// ═══ PILLAR 5: REPUTATION (10%) ═══
function scoreReputation(input: ScoringInput): { score: number; breakdown: Record<string, { score: number; maxScore: number; signal: string }> } {
  // Followers
  const followerScore = tiered(input.followers, [
    [10, 2], [50, 4], [200, 7], [1000, 10],
  ]);

  // Follower ratio
  const ratio = input.following > 0 ? input.followers / input.following : input.followers;
  const ratioBonus = ratio > 5 ? 2 : ratio > 2 ? 1 : ratio < 0.5 ? -1 : 0;

  // Notable orgs
  const notableOrgCount = input.organizations.filter((o) => NOTABLE_ORGS.has(o.toLowerCase())).length;
  const orgBonus = Math.min(3, notableOrgCount);

  const raw = Math.min(10, followerScore * 0.6 + (ratioBonus + 1) * 0.6 + orgBonus * 0.6);
  const normalized = Math.round(raw * 10);

  return {
    score: normalized,
    breakdown: {
      followers: { score: followerScore * 10, maxScore: 100, signal: `${input.followers} followers` },
      ratio: { score: Math.max(0, (ratioBonus + 1) * 33), maxScore: 100, signal: `${ratio.toFixed(1)}:1 follower ratio` },
      orgs: { score: orgBonus * 33, maxScore: 100, signal: `${notableOrgCount} notable org memberships` },
    },
  };
}

// ═══ CONFIDENCE MODIFIER ═══
function computeConfidence(input: ScoringInput): { confidence: "high" | "medium" | "low"; modifier: number } {
  const recentlyActive = input.contributionDays.some((d) => {
    const daysAgo = (Date.now() - new Date(d.date).getTime()) / (1000 * 60 * 60 * 24);
    return d.count > 0 && daysAgo <= 90;
  });

  if (input.publicRepos >= 10 && input.totalContributions >= 200 && recentlyActive) {
    return { confidence: "high", modifier: 1.0 };
  }
  if (input.publicRepos >= 5 && input.totalContributions >= 50) {
    return { confidence: "medium", modifier: 0.9 };
  }
  // Low confidence = estimated, but don't crush the score
  return { confidence: "low", modifier: 0.75 };
}

// ═══ TIER ASSIGNMENT ═══
function getTier(score: number): { emoji: string; label: string; color: string } {
  if (score >= 90) return { emoji: "🦄", label: "Unicorn", color: "#AFA9EC" };
  if (score >= 75) return { emoji: "🔥", label: "On Fire", color: "#EF9F27" };
  if (score >= 60) return { emoji: "💎", label: "Gem", color: "#85B7EB" };
  if (score >= 40) return { emoji: "🌱", label: "Seedling", color: "#5DCAA5" };
  return { emoji: "🌫️", label: "Mystery", color: "#888780" };
}

// ═══ MAIN SCORING FUNCTION ═══
export function calculateScore(input: ScoringInput): ScoreResult {
  const impact = scoreImpact(input);
  const contribution = scoreContribution(input);
  const consistency = scoreConsistency(input);
  const technical = scoreTechnical(input);
  const reputation = scoreReputation(input);
  const { confidence, modifier } = computeConfidence(input);

  const weighted =
    impact.score * 0.30 +
    contribution.score * 0.25 +
    consistency.score * 0.20 +
    technical.score * 0.15 +
    reputation.score * 0.10;

  const total = Math.round(weighted * modifier * 10) / 10;
  const tier = getTier(total);

  return {
    total,
    impact: impact.score,
    contributionQuality: contribution.score,
    consistency: consistency.score,
    technicalDepth: technical.score,
    reputation: reputation.score,
    confidence,
    confidenceModifier: modifier,
    tier,
    breakdown: {
      ...Object.fromEntries(Object.entries(impact.breakdown).map(([k, v]) => [`impact_${k}`, v])),
      ...Object.fromEntries(Object.entries(contribution.breakdown).map(([k, v]) => [`contribution_${k}`, v])),
      ...Object.fromEntries(Object.entries(consistency.breakdown).map(([k, v]) => [`consistency_${k}`, v])),
      ...Object.fromEntries(Object.entries(technical.breakdown).map(([k, v]) => [`technical_${k}`, v])),
      ...Object.fromEntries(Object.entries(reputation.breakdown).map(([k, v]) => [`reputation_${k}`, v])),
    },
  };
}
