// Compensation band estimation based on public market data signals
// Uses: seniority, location, company tier, and open-source signal
//
// DISCLAIMER: These are estimates based on publicly available market ranges.
// Not exact salary data. Intended for recruiter planning, not offers.

export interface CompBand {
  low: number;
  mid: number;
  high: number;
  currency: string;
  confidence: "high" | "medium" | "low";
  basis: string[]; // what signals drove this estimate
}

export interface CompEstimate {
  seniority: string;
  locationTier: string;
  companyTier: string;
  baseSalary: CompBand;
  totalComp: CompBand; // base + equity + bonus
  marketPosition: string; // "below market" | "at market" | "above market"
}

// ═══════════════════════════════════════════════════════════
//  SENIORITY DETECTION
// ═══════════════════════════════════════════════════════════

type SeniorityLevel = "junior" | "mid" | "senior" | "staff" | "principal";

export function detectSeniority(signals: {
  accountAgeYears?: number;
  totalCommits?: number;
  followers?: number;
  publicRepos?: number;
  totalStars?: number;
  title?: string | null;
  yearsExperience?: number;
  score?: number;
}): { level: SeniorityLevel; confidence: "high" | "medium" | "low" } {
  // Title-based detection (highest confidence)
  if (signals.title) {
    const t = signals.title.toLowerCase();
    if (t.includes("principal") || t.includes("distinguished") || t.includes("fellow"))
      return { level: "principal", confidence: "high" };
    if (t.includes("staff") || t.includes("architect"))
      return { level: "staff", confidence: "high" };
    if (t.includes("senior") || t.includes("sr.") || t.includes("sr ") || t.includes("lead"))
      return { level: "senior", confidence: "high" };
    if (t.includes("junior") || t.includes("jr.") || t.includes("jr ") || t.includes("intern"))
      return { level: "junior", confidence: "high" };
  }

  // YoE-based detection
  if (signals.yearsExperience) {
    if (signals.yearsExperience >= 12) return { level: "principal", confidence: "medium" };
    if (signals.yearsExperience >= 8) return { level: "staff", confidence: "medium" };
    if (signals.yearsExperience >= 5) return { level: "senior", confidence: "medium" };
    if (signals.yearsExperience >= 2) return { level: "mid", confidence: "medium" };
    return { level: "junior", confidence: "medium" };
  }

  // Signal-based inference (lowest confidence)
  const age = signals.accountAgeYears || 0;
  const followers = signals.followers || 0;
  const stars = signals.totalStars || 0;
  const score = signals.score || 0;

  if (score >= 90 || followers >= 50000 || stars >= 50000 || age >= 15)
    return { level: "principal", confidence: "low" };
  if (score >= 75 || followers >= 5000 || stars >= 10000 || age >= 12)
    return { level: "staff", confidence: "low" };
  if (score >= 65 || followers >= 1000 || stars >= 2000 || age >= 7)
    return { level: "senior", confidence: "low" };
  if (score >= 40 || followers >= 200 || age >= 3)
    return { level: "mid", confidence: "low" };

  return { level: "junior", confidence: "low" };
}

// ═══════════════════════════════════════════════════════════
//  LOCATION TIER
// ═══════════════════════════════════════════════════════════

type LocationTier = "tier1" | "tier2" | "tier3" | "tier4" | "tier5" | "remote" | "unknown";

const TIER1_LOCATIONS = [
  "san francisco", "sf", "bay area", "silicon valley", "palo alto", "mountain view", "menlo park",
  "new york", "nyc", "manhattan", "brooklyn",
  "seattle", "bellevue", "redmond",
];

const TIER2_LOCATIONS = [
  "austin", "denver", "boulder", "boston", "cambridge", "los angeles", "la",
  "san diego", "portland", "chicago", "washington", "dc", "miami",
  "atlanta", "raleigh", "salt lake city", "nashville",
];

const TIER3_LOCATIONS = [
  "united states", "usa", "us", "america", // generic US
  "phoenix", "dallas", "houston", "minneapolis", "detroit", "pittsburgh",
  "columbus", "charlotte", "indianapolis", "kansas city", "richmond",
];

const TIER4_LOCATIONS = [
  "london", "berlin", "amsterdam", "zurich", "stockholm", "copenhagen", "dublin",
  "paris", "munich", "barcelona", "tel aviv", "singapore", "tokyo", "sydney",
  "toronto", "vancouver", "melbourne",
];

const TIER5_LOCATIONS = [
  "bangalore", "hyderabad", "pune", "mumbai", "delhi", "india",
  "buenos aires", "sao paulo", "são paulo", "brazil", "argentina",
  "lagos", "nigeria", "nairobi", "kenya",
  "warsaw", "krakow", "poland", "kyiv", "ukraine",
  "bucharest", "romania", "serbia", "belgrade",
];

export function detectLocationTier(location: string | null): { tier: LocationTier; multiplier: number; label: string } {
  if (!location) return { tier: "unknown", multiplier: 0.85, label: "Unknown" };

  const loc = location.toLowerCase().trim();

  if (loc === "remote") return { tier: "remote", multiplier: 0.90, label: "Remote" };

  if (TIER1_LOCATIONS.some((l) => loc.includes(l)))
    return { tier: "tier1", multiplier: 1.0, label: "Tier 1 (SF/NYC/Seattle)" };
  if (TIER2_LOCATIONS.some((l) => loc.includes(l)))
    return { tier: "tier2", multiplier: 0.90, label: "Tier 2 (Major US Metro)" };
  if (TIER3_LOCATIONS.some((l) => loc.includes(l)))
    return { tier: "tier3", multiplier: 0.82, label: "Tier 3 (US Other)" };
  if (TIER4_LOCATIONS.some((l) => loc.includes(l)))
    return { tier: "tier4", multiplier: 0.78, label: "Tier 4 (Intl Major)" };
  if (TIER5_LOCATIONS.some((l) => loc.includes(l)))
    return { tier: "tier5", multiplier: 0.50, label: "Tier 5 (Intl Emerging)" };

  // If contains common country/region indicators
  if (loc.includes("california") || loc.includes("ca,"))
    return { tier: "tier1", multiplier: 1.0, label: "Tier 1 (California)" };
  if (loc.includes("united states") || loc.includes("usa"))
    return { tier: "tier3", multiplier: 0.82, label: "Tier 3 (US)" };

  return { tier: "unknown", multiplier: 0.75, label: "Unknown" };
}

// ═══════════════════════════════════════════════════════════
//  COMPANY TIER
// ═══════════════════════════════════════════════════════════

const FAANG_COMPANIES = [
  "google", "alphabet", "meta", "facebook", "apple", "amazon", "microsoft",
  "netflix", "nvidia", "openai", "anthropic", "deepmind",
  "tesla", "uber", "airbnb", "salesforce", "oracle", "adobe", "intel",
  "bloomberg", "palantir", "coinbase", "doordash", "instacart", "lyft",
  "twitch", "github", "linkedin",
];

// Major foundations and non-profit tech orgs — comp is lower but prestige is high
const FOUNDATION_COMPANIES = [
  "linux foundation", "mozilla", "apache", "eclipse foundation",
  "cloud native", "cncf", "open source", "free software",
  "python software", "rust foundation", "node.js",
];

const UNICORN_COMPANIES = [
  "stripe", "databricks", "datadog", "cloudflare", "vercel", "figma",
  "notion", "linear", "retool", "ramp", "rippling", "anduril",
  "scale ai", "hugging face", "mistral", "cohere", "perplexity",
  "snowflake", "confluent", "hashicorp", "elastic",
];

const SERIES_BD = [
  "coreweave", "modal", "anyscale", "replicate", "lambda", "together ai",
  "runway", "stability ai", "replit", "supabase", "planetscale",
  "neon", "turso", "fly.io", "railway", "render",
];

export function detectCompanyTier(company: string | null): { tier: string; multiplier: number; label: string } {
  if (!company) return { tier: "unknown", multiplier: 1.0, label: "Unknown" };

  const c = company.toLowerCase().replace(/^@/, "").trim();

  if (FAANG_COMPANIES.some((f) => c.includes(f)))
    return { tier: "faang", multiplier: 1.35, label: "FAANG+" };
  if (UNICORN_COMPANIES.some((u) => c.includes(u)))
    return { tier: "unicorn", multiplier: 1.20, label: "Unicorn" };
  if (SERIES_BD.some((s) => c.includes(s)))
    return { tier: "growth", multiplier: 1.05, label: "Growth Stage" };
  if (FOUNDATION_COMPANIES.some((f) => c.includes(f)))
    return { tier: "foundation", multiplier: 0.85, label: "Foundation / Non-Profit" };

  // If company name exists, assume mid-market
  return { tier: "mid", multiplier: 1.0, label: "Mid-Market" };
}

// ═══════════════════════════════════════════════════════════
//  BASE COMP BANDS (Tier 1, USD, Software Engineering)
//  Source: Levels.fyi / Glassdoor / public comp data 2024-2025
// ═══════════════════════════════════════════════════════════

const BASE_BANDS: Record<SeniorityLevel, { low: number; mid: number; high: number }> = {
  junior:    { low: 85000,  mid: 110000, high: 140000 },
  mid:       { low: 120000, mid: 155000, high: 190000 },
  senior:    { low: 160000, mid: 200000, high: 250000 },
  staff:     { low: 210000, mid: 270000, high: 350000 },
  principal: { low: 280000, mid: 360000, high: 450000 },
};

// Total comp multiplier (base → base + equity + bonus)
const TC_MULTIPLIERS: Record<SeniorityLevel, { faang: number; unicorn: number; other: number }> = {
  junior:    { faang: 1.4, unicorn: 1.25, other: 1.1 },
  mid:       { faang: 1.5, unicorn: 1.3, other: 1.15 },
  senior:    { faang: 1.7, unicorn: 1.4, other: 1.2 },
  staff:     { faang: 2.0, unicorn: 1.6, other: 1.3 },
  principal: { faang: 2.5, unicorn: 1.8, other: 1.4 },
};

// ═══════════════════════════════════════════════════════════
//  MAIN ESTIMATOR
// ═══════════════════════════════════════════════════════════

export function estimateCompensation(signals: {
  accountAgeYears?: number;
  totalCommits?: number;
  followers?: number;
  publicRepos?: number;
  totalStars?: number;
  title?: string | null;
  location?: string | null;
  company?: string | null;
  yearsExperience?: number;
  score?: number;
  packageScore?: number; // from package enrichment
}): CompEstimate {
  const seniority = detectSeniority(signals);
  const locationInfo = detectLocationTier(signals.location ?? null);
  const companyInfo = detectCompanyTier(signals.company ?? null);
  const basis: string[] = [];

  // Base band for this seniority
  const band = BASE_BANDS[seniority.level];

  // Apply location multiplier
  const locAdjustedLow = Math.round(band.low * locationInfo.multiplier);
  const locAdjustedMid = Math.round(band.mid * locationInfo.multiplier);
  const locAdjustedHigh = Math.round(band.high * locationInfo.multiplier);

  // Package maintainer bonus (maintaining popular packages = premium signal)
  const pkgBonus = signals.packageScore
    ? signals.packageScore >= 50 ? 1.10 : signals.packageScore >= 20 ? 1.05 : 1.0
    : 1.0;

  if (pkgBonus > 1.0) basis.push("Popular package maintainer");

  // High followers/stars bonus (public profile = recruiter magnet)
  const profileBonus =
    (signals.followers || 0) >= 10000 ? 1.08 :
    (signals.followers || 0) >= 5000 ? 1.05 :
    (signals.followers || 0) >= 1000 ? 1.02 : 1.0;

  if (profileBonus > 1.0) basis.push("High public visibility");

  // Final base salary
  const finalLow = Math.round(locAdjustedLow * pkgBonus * profileBonus / 1000) * 1000;
  const finalMid = Math.round(locAdjustedMid * pkgBonus * profileBonus / 1000) * 1000;
  const finalHigh = Math.round(locAdjustedHigh * pkgBonus * profileBonus / 1000) * 1000;

  // Total comp
  const tcMultiplierKey = companyInfo.tier === "faang" ? "faang" : companyInfo.tier === "unicorn" ? "unicorn" : "other";
  const tcMult = TC_MULTIPLIERS[seniority.level][tcMultiplierKey];

  const tcLow = Math.round(finalLow * tcMult / 1000) * 1000;
  const tcMid = Math.round(finalMid * tcMult / 1000) * 1000;
  const tcHigh = Math.round(finalHigh * tcMult / 1000) * 1000;

  // Determine confidence
  const confidenceFactors = [
    seniority.confidence === "high" ? 2 : seniority.confidence === "medium" ? 1 : 0,
    locationInfo.tier !== "unknown" ? 1 : 0,
    companyInfo.tier !== "unknown" ? 1 : 0,
  ];
  const confScore = confidenceFactors.reduce((s, f) => s + f, 0);
  const confidence: "high" | "medium" | "low" = confScore >= 3 ? "high" : confScore >= 2 ? "medium" : "low";

  // Build basis explanations
  basis.unshift(`${seniority.level.charAt(0).toUpperCase() + seniority.level.slice(1)}-level (${seniority.confidence} confidence)`);
  basis.push(`Location: ${locationInfo.label}`);
  if (companyInfo.tier !== "unknown") basis.push(`Company: ${companyInfo.label}`);

  // Market position (rough — based on score relative to band)
  const marketPosition =
    (signals.score || 0) >= 80 ? "Above market" :
    (signals.score || 0) >= 50 ? "At market" : "Below market";

  return {
    seniority: seniority.level,
    locationTier: locationInfo.label,
    companyTier: companyInfo.label,
    baseSalary: { low: finalLow, mid: finalMid, high: finalHigh, currency: "USD", confidence, basis },
    totalComp: { low: tcLow, mid: tcMid, high: tcHigh, currency: "USD", confidence, basis },
    marketPosition,
  };
}

// Helper: format as "$150K - $200K"
export function formatCompRange(band: CompBand): string {
  return `$${Math.round(band.low / 1000)}K - $${Math.round(band.high / 1000)}K`;
}

export function formatCompMid(band: CompBand): string {
  return `$${Math.round(band.mid / 1000)}K`;
}
