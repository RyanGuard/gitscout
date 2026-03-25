// QA Test Helpers — grades search results on quality

export interface SearchResult {
  developers: Array<{
    username: string;
    name: string | null;
    location: string | null;
    followers: number;
    publicRepos: number;
    totalStars: number;
    score: number;
    bio: string | null;
    primaryLanguage: string | null;
    languages: Array<{ language: string }>;
    tier?: string;
    source?: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
  query: string;
}

export interface QualityGrade {
  query: string;
  resultCount: number;
  avgScore: number;
  avgFollowers: number;
  avgStars: number;
  unicorns: number;
  strongPlus: number;
  hasLocation: number;
  hasEmail: number;
  hasCorrectLanguage: number;
  loadTimeMs: number;
  grade: "A" | "B" | "C" | "D" | "F";
  issues: string[];
}

export function gradeResults(
  query: string,
  results: SearchResult,
  loadTimeMs: number,
  expectedLanguage?: string,
  expectedLocation?: string
): QualityGrade {
  const devs = results.developers || [];
  const issues: string[] = [];

  if (devs.length === 0) {
    return {
      query,
      resultCount: 0,
      avgScore: 0,
      avgFollowers: 0,
      avgStars: 0,
      unicorns: 0,
      strongPlus: 0,
      hasLocation: 0,
      hasEmail: 0,
      hasCorrectLanguage: 0,
      loadTimeMs,
      grade: "F",
      issues: ["No results returned"],
    };
  }

  const avgScore = devs.reduce((s, d) => s + (d.score || 0), 0) / devs.length;
  const avgFollowers = devs.reduce((s, d) => s + (d.followers || 0), 0) / devs.length;
  const avgStars = devs.reduce((s, d) => s + (d.totalStars || 0), 0) / devs.length;
  const unicorns = devs.filter((d) => (d.score || 0) >= 90).length;
  const strongPlus = devs.filter((d) => (d.score || 0) >= 75).length;
  const hasLocation = devs.filter((d) => d.location).length;
  const hasEmail = devs.filter((d) => (d as Record<string, unknown>).email).length;

  // Check language relevance
  let hasCorrectLanguage = devs.length; // default all correct if no expected
  if (expectedLanguage) {
    hasCorrectLanguage = devs.filter((d) => {
      const langs = d.languages?.map((l) => l.language.toLowerCase()) || [];
      const primary = d.primaryLanguage?.toLowerCase();
      const target = expectedLanguage.toLowerCase();
      return langs.includes(target) || primary === target;
    }).length;
  }

  // Check location relevance
  if (expectedLocation) {
    const locLower = expectedLocation.toLowerCase();
    const correctLoc = devs.filter((d) => {
      const devLoc = (d.location || "").toLowerCase();
      return devLoc.includes(locLower) || locLower.includes(devLoc);
    }).length;
    if (correctLoc < devs.length * 0.3) {
      issues.push(`Only ${correctLoc}/${devs.length} in expected location "${expectedLocation}"`);
    }
  }

  // Quality checks
  if (avgFollowers < 50) issues.push(`Low avg followers: ${Math.round(avgFollowers)}`);
  if (avgScore < 30) issues.push(`Low avg score: ${avgScore.toFixed(1)}`);
  if (devs.length < 5) issues.push(`Only ${devs.length} results (expected 10+)`);
  if (loadTimeMs > 15000) issues.push(`Slow: ${(loadTimeMs / 1000).toFixed(1)}s`);
  if (expectedLanguage && hasCorrectLanguage < devs.length * 0.5) {
    issues.push(`Only ${hasCorrectLanguage}/${devs.length} match language "${expectedLanguage}"`);
  }

  // Grade
  let points = 0;
  if (devs.length >= 10) points += 2;
  else if (devs.length >= 5) points += 1;
  if (avgFollowers >= 500) points += 2;
  else if (avgFollowers >= 100) points += 1;
  if (avgScore >= 60) points += 2;
  else if (avgScore >= 40) points += 1;
  if (unicorns >= 1) points += 1;
  if (strongPlus >= 3) points += 1;
  if (loadTimeMs < 5000) points += 1;
  if (issues.length === 0) points += 1;

  const grade: "A" | "B" | "C" | "D" | "F" =
    points >= 9 ? "A" : points >= 7 ? "B" : points >= 5 ? "C" : points >= 3 ? "D" : "F";

  return {
    query,
    resultCount: devs.length,
    avgScore: Math.round(avgScore * 10) / 10,
    avgFollowers: Math.round(avgFollowers),
    avgStars: Math.round(avgStars),
    unicorns,
    strongPlus,
    hasLocation,
    hasEmail,
    hasCorrectLanguage,
    loadTimeMs,
    grade,
    issues,
  };
}

export function printGradeReport(grades: QualityGrade[]) {
  console.log("\n" + "═".repeat(80));
  console.log("  GITSCOUT QA REPORT CARD");
  console.log("═".repeat(80));

  for (const g of grades) {
    const emoji = g.grade === "A" ? "🟢" : g.grade === "B" ? "🔵" : g.grade === "C" ? "🟡" : g.grade === "D" ? "🟠" : "🔴";
    console.log(`\n${emoji} [${g.grade}] "${g.query}"`);
    console.log(`   Results: ${g.resultCount} | Avg Score: ${g.avgScore} | Avg Followers: ${g.avgFollowers} | 🦄: ${g.unicorns} | 🔥: ${g.strongPlus}`);
    console.log(`   Load: ${(g.loadTimeMs / 1000).toFixed(1)}s`);
    if (g.issues.length > 0) {
      console.log(`   ⚠️  ${g.issues.join(" | ")}`);
    }
  }

  const avgGrade = grades.reduce((s, g) => s + ("ABCDF".indexOf(g.grade)), 0) / grades.length;
  const overallGrade = avgGrade < 1 ? "A" : avgGrade < 2 ? "B" : avgGrade < 3 ? "C" : avgGrade < 4 ? "D" : "F";
  const passing = grades.filter((g) => "ABC".includes(g.grade)).length;

  console.log("\n" + "─".repeat(80));
  console.log(`  OVERALL: ${overallGrade} | Passing: ${passing}/${grades.length} | Failed: ${grades.length - passing}`);
  console.log("─".repeat(80) + "\n");
}
