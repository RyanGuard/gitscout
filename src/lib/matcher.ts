import type { ParsedRequirements, MatchResult, DeveloperProfile } from "@/types";

// --- Seniority inference thresholds ---

function inferSeniority(dev: DeveloperProfile): string {
  const accountAge = dev.repositories.length > 0
    ? Math.max(
        ...dev.repositories
          .map((r) => r.pushedAt ? new Date(r.pushedAt).getTime() : 0)
          .filter(Boolean)
      )
    : 0;

  // Rough heuristic: use totalStars, followers, totalCommits
  const stars = dev.totalStars;
  const commits = dev.totalCommits;
  const followers = dev.followers;

  if (commits >= 1000 && stars >= 500 && followers >= 100) return "staff";
  if (commits >= 500 && stars >= 100 && followers >= 50) return "senior";
  if (commits >= 100) return "mid";
  return "junior";
}

// --- Fuzzy location matching ---

function locationsMatch(
  devLocation: string | null,
  requiredLocation: string | null
): boolean {
  if (!requiredLocation) return true;
  if (requiredLocation.toLowerCase() === "remote") return true;
  if (!devLocation) return false;

  const devLower = devLocation.toLowerCase();
  const reqLower = requiredLocation.toLowerCase();

  // Direct substring match
  if (devLower.includes(reqLower) || reqLower.includes(devLower)) return true;

  // Check common abbreviations
  const abbreviations: Record<string, string[]> = {
    "san francisco": ["sf", "bay area", "san francisco"],
    "new york": ["nyc", "new york", "ny"],
    "los angeles": ["la", "los angeles"],
    "washington dc": ["dc", "washington"],
  };

  for (const [canonical, aliases] of Object.entries(abbreviations)) {
    const matchesReq = aliases.some((a) => reqLower.includes(a)) || reqLower.includes(canonical);
    const matchesDev = aliases.some((a) => devLower.includes(a)) || devLower.includes(canonical);
    if (matchesReq && matchesDev) return true;
  }

  return false;
}

// --- Skill matching from repos ---

function extractDevSkills(dev: DeveloperProfile): Set<string> {
  const skills = new Set<string>();

  for (const repo of dev.repositories) {
    // Topics
    for (const topic of repo.topics) {
      skills.add(topic.toLowerCase());
    }
    // Repo name words
    const nameWords = repo.name.toLowerCase().split(/[-_./]/);
    for (const word of nameWords) {
      if (word.length > 1) skills.add(word);
    }
    // Description words
    if (repo.description) {
      const descWords = repo.description.toLowerCase().split(/\s+/);
      for (const word of descWords) {
        if (word.length > 2) skills.add(word.replace(/[^a-z0-9.#+-]/g, ""));
      }
    }
  }

  return skills;
}

function matchSkills(
  devSkills: Set<string>,
  required: string[]
): string[] {
  const matched: string[] = [];

  for (const req of required) {
    const reqLower = req.toLowerCase();
    // Direct match
    if (devSkills.has(reqLower)) {
      matched.push(req);
      continue;
    }
    // Partial match: check if any dev skill contains the required term or vice versa
    for (const skill of devSkills) {
      if (
        skill.includes(reqLower) ||
        reqLower.includes(skill)
      ) {
        matched.push(req);
        break;
      }
    }
  }

  return matched;
}

// --- Main scoring ---

export function computeFitScore(
  requirements: ParsedRequirements,
  developer: DeveloperProfile
): MatchResult {
  const reasons: string[] = [];
  let fitScore = 0;

  // 1. Language match (40%)
  const devLanguages = new Set(
    developer.languages.map((l) => l.language.toLowerCase())
  );
  const matchedLanguages: string[] = [];

  for (const lang of requirements.languages) {
    if (devLanguages.has(lang.toLowerCase())) {
      matchedLanguages.push(lang);
    }
  }

  const langScore =
    requirements.languages.length > 0
      ? matchedLanguages.length / requirements.languages.length
      : 0;
  fitScore += langScore * 40;

  if (matchedLanguages.length > 0) {
    reasons.push(`Matches ${matchedLanguages.join(", ")}`);
  }

  // 2. Skill/framework match (25%)
  const allRequiredSkills = [
    ...requirements.frameworks,
    ...requirements.tools,
  ];
  const devSkills = extractDevSkills(developer);
  const matchedSkills = matchSkills(devSkills, allRequiredSkills);

  const skillScore =
    allRequiredSkills.length > 0
      ? matchedSkills.length / allRequiredSkills.length
      : 0;
  fitScore += skillScore * 25;

  if (matchedSkills.length > 0) {
    reasons.push(`Skills: ${matchedSkills.join(", ")}`);
  }

  // 3. Location match (10%)
  const locationMatch = locationsMatch(
    developer.location,
    requirements.location
  );
  fitScore += locationMatch ? 10 : 0;

  if (locationMatch && requirements.location) {
    if (requirements.location.toLowerCase() === "remote") {
      reasons.push("Remote-friendly");
    } else if (developer.location) {
      reasons.push(`Located in ${developer.location}`);
    }
  }

  // 4. Seniority match (10%)
  const devSeniority = inferSeniority(developer);
  const seniorityMatch = !requirements.seniority || devSeniority === requirements.seniority;

  if (seniorityMatch && requirements.seniority) {
    fitScore += 10;
    reasons.push(
      `${requirements.seniority.charAt(0).toUpperCase() + requirements.seniority.slice(1)}-level based on activity`
    );
  } else if (!requirements.seniority) {
    fitScore += 5; // partial credit when no seniority required
  }

  // 5. Activity/quality (15%)
  // Normalize each component to 0-1 range using log scaling
  const commitNorm = Math.min(1, Math.log(1 + developer.totalCommits) / Math.log(1 + 1000));
  const qualityNorm = Math.min(1, (developer.score || 0) / 100);
  const activityScore = (commitNorm * 0.5 + qualityNorm * 0.5);
  fitScore += activityScore * 15;

  if (developer.totalCommits >= 500) {
    reasons.push(`${developer.totalCommits.toLocaleString()} commits`);
  }

  // Round to one decimal
  fitScore = Math.round(Math.min(100, fitScore) * 10) / 10;

  return {
    developer,
    fitScore,
    matchedLanguages,
    matchedSkills,
    locationMatch,
    seniorityMatch,
    reasons,
  };
}
