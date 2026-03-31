/**
 * Post-enrichment tier scoring for market map companies.
 *
 * After Apollo enrichment fills in headcount, funding stage, tech stack,
 * growth rate, and HQ location, this module re-evaluates tier assignment
 * using structured signals instead of Claude's initial guess.
 */

// ── Types ────────────────────────────────────────────────────

export interface EnrichedCompany {
  techStack: string[];
  headcount: number | null;
  fundingStage: string | null;
  growthRate: string | null;
  hqCity: string | null;
  hqCountry: string | null;
  tierReasoning: string | null;
}

export interface RoleBrief {
  roleStack: string[];
  roleLevel: string | null;
  geography: string[];
}

export interface TierBreakdown {
  stack: number;
  headcount: number;
  funding: number;
  domain: number;
  growth: number;
  geo: number;
}

// ── Signal weights ───────────────────────────────────────────

const WEIGHTS: Record<keyof TierBreakdown, number> = {
  stack: 0.3,
  headcount: 0.2,
  funding: 0.15,
  domain: 0.2,
  growth: 0.1,
  geo: 0.05,
};

// ── Headcount ideal ranges by role level ─────────────────────
// Bell curve: score 100 at center, drops linearly to 0 at edges.

const HEADCOUNT_RANGES: Record<string, { ideal: number; min: number; max: number }> = {
  junior:    { ideal: 200,  min: 10,   max: 2000 },
  mid:       { ideal: 300,  min: 20,   max: 3000 },
  senior:    { ideal: 500,  min: 50,   max: 5000 },
  staff:     { ideal: 1000, min: 100,  max: 10000 },
  principal: { ideal: 2000, min: 200,  max: 20000 },
};

// ── Funding stage expected by role level ─────────────────────

const STAGE_ORDER = ["pre_seed", "seed", "series_a", "series_b", "series_c", "series_d", "series_e", "ipo", "public"];

const LEVEL_STAGE_RANGES: Record<string, { min: number; max: number }> = {
  junior:    { min: 0, max: 4 },  // pre_seed → series_b
  mid:       { min: 0, max: 5 },  // pre_seed → series_c
  senior:    { min: 2, max: 7 },  // series_a → ipo
  staff:     { min: 4, max: 8 },  // series_c → public
  principal: { min: 5, max: 8 },  // series_d → public
};

// ── Scoring functions ────────────────────────────────────────

function scoreStack(companyStack: string[], roleStack: string[]): number {
  if (roleStack.length === 0) return 50; // neutral if no role stack specified
  const companyLower = new Set(companyStack.map((s) => s.toLowerCase()));
  const matches = roleStack.filter((s) => companyLower.has(s.toLowerCase())).length;
  return Math.round((matches / roleStack.length) * 100);
}

function scoreHeadcount(headcount: number | null, roleLevel: string | null): number {
  if (headcount === null) return 50; // neutral if unknown
  const level = (roleLevel || "senior").toLowerCase();
  const range = HEADCOUNT_RANGES[level] || HEADCOUNT_RANGES.senior;

  if (headcount <= range.ideal) {
    // Scale from min→ideal: 0→100
    if (headcount <= range.min) return 0;
    return Math.round(((headcount - range.min) / (range.ideal - range.min)) * 100);
  }
  // Scale from ideal→max: 100→0
  if (headcount >= range.max) return 0;
  return Math.round(((range.max - headcount) / (range.max - range.ideal)) * 100);
}

function normalizeFundingStage(stage: string): number {
  const lower = stage.toLowerCase().replace(/[^a-z_]/g, "").replace(/series/g, "series_");
  // Handle common variants
  const normalized = lower
    .replace("pre_seed", "pre_seed")
    .replace("series__", "series_")
    .replace("seed", "seed")
    .replace("ipo", "ipo")
    .replace("public_company", "public")
    .replace("public", "public");

  const idx = STAGE_ORDER.findIndex((s) => normalized.includes(s));
  return idx >= 0 ? idx : -1;
}

function scoreFunding(fundingStage: string | null, roleLevel: string | null): number {
  if (!fundingStage) return 50; // neutral if unknown
  const idx = normalizeFundingStage(fundingStage);
  if (idx < 0) return 50; // unrecognized stage

  const level = (roleLevel || "senior").toLowerCase();
  const range = LEVEL_STAGE_RANGES[level] || LEVEL_STAGE_RANGES.senior;

  if (idx >= range.min && idx <= range.max) return 100;
  // Penalize by distance from acceptable range
  const distance = idx < range.min ? range.min - idx : idx - range.max;
  return Math.max(0, 100 - distance * 25);
}

function scoreDomain(tierReasoning: string | null): number {
  // Keep Claude's initial domain relevance assessment.
  // If no reasoning exists, return neutral.
  if (!tierReasoning) return 50;
  // Claude's reasoning is free-text. Heuristic: if it contains strong
  // positive indicators, score high; weak indicators, score lower.
  const lower = tierReasoning.toLowerCase();
  const strongSignals = ["direct competitor", "exact same", "same space", "identical stack", "same technical challenges"];
  const moderateSignals = ["adjacent", "similar", "skills transfer", "overlapping"];
  const weakSignals = ["stretch", "harder to recruit", "prestigious", "larger"];

  if (strongSignals.some((s) => lower.includes(s))) return 90;
  if (moderateSignals.some((s) => lower.includes(s))) return 65;
  if (weakSignals.some((s) => lower.includes(s))) return 40;
  return 60; // generic reasoning → moderate score
}

function scoreGrowth(growthRate: string | null): number {
  if (!growthRate) return 50; // neutral if unknown
  // Parse percentage from strings like "25% YoY", "10-20%", "-5%"
  const match = growthRate.match(/-?\d+/);
  if (!match) return 50;
  const pct = parseInt(match[0], 10);
  // Higher growth = higher score, capped at 100
  if (pct < 0) return 20;
  if (pct <= 5) return 40;
  if (pct <= 15) return 60;
  if (pct <= 30) return 80;
  return 100;
}

function scoreGeo(hqCity: string | null, hqCountry: string | null, geography: string[]): number {
  if (geography.length === 0) return 100; // no geo preference = all match
  if (!hqCity && !hqCountry) return 50; // unknown location = neutral
  const loc = `${hqCity || ""} ${hqCountry || ""}`.toLowerCase();
  const hasMatch = geography.some((g) => {
    const gLower = g.toLowerCase();
    return loc.includes(gLower) || gLower.includes(hqCity?.toLowerCase() || "__none__");
  });
  return hasMatch ? 100 : 30;
}

// ── Public API ───────────────────────────────────────────────

export function scoreTier(company: EnrichedCompany, roleBrief: RoleBrief): { score: number; breakdown: TierBreakdown } {
  const breakdown: TierBreakdown = {
    stack: scoreStack(company.techStack, roleBrief.roleStack),
    headcount: scoreHeadcount(company.headcount, roleBrief.roleLevel),
    funding: scoreFunding(company.fundingStage, roleBrief.roleLevel),
    domain: scoreDomain(company.tierReasoning),
    growth: scoreGrowth(company.growthRate),
    geo: scoreGeo(company.hqCity, company.hqCountry, roleBrief.geography),
  };

  const score = Math.round(
    breakdown.stack * WEIGHTS.stack +
    breakdown.headcount * WEIGHTS.headcount +
    breakdown.funding * WEIGHTS.funding +
    breakdown.domain * WEIGHTS.domain +
    breakdown.growth * WEIGHTS.growth +
    breakdown.geo * WEIGHTS.geo
  );

  return { score, breakdown };
}

export function assignTier(score: number): "A" | "B" | "C" {
  if (score > 75) return "A";
  if (score >= 50) return "B";
  return "C";
}
