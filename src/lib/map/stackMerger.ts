import { parseJobDescription } from "@/lib/jd-parser";
import type { ATSScanResult } from "./atsScanner";
import type { GitHubStackResult } from "./githubStackDetector";

export interface StackMergeResult {
  techStackVerified: string[];
  techStackSources: Record<string, string[]>;
  stackConfidence: Record<string, "confirmed" | "likely" | "reported">;
  jdCount: number;
}

function normalizeApollo(item: string): string | null {
  // Run through parseJobDescription to normalize Apollo stack items
  const parsed = parseJobDescription(item);
  if (parsed.languages.length > 0) return parsed.languages[0];
  if (parsed.frameworks.length > 0) return parsed.frameworks[0];
  if (parsed.tools.length > 0) return parsed.tools[0];
  // If parser doesn't recognize it, return title-cased original
  return item.trim() || null;
}

/**
 * Merges tech stack signals from ATS, GitHub, and Apollo into a unified,
 * confidence-rated stack list.
 */
export function mergeStackSignals(
  atsResult: ATSScanResult | null,
  githubResult: GitHubStackResult | null,
  apolloStack: string[]
): StackMergeResult {
  // tech name → Set<source string>
  const sourceMap = new Map<string, Set<string>>();

  function addSignal(tech: string, source: string) {
    const existing = sourceMap.get(tech);
    if (existing) {
      existing.add(source);
    } else {
      sourceMap.set(tech, new Set([source]));
    }
  }

  // From ATS
  if (atsResult) {
    const atsSource = `jd:${atsResult.source}:${atsResult.jobCount}`;
    for (const lang of atsResult.mergedTech.languages) addSignal(lang, atsSource);
    for (const fw of atsResult.mergedTech.frameworks) addSignal(fw, atsSource);
    for (const tool of atsResult.mergedTech.tools) addSignal(tool, atsSource);
  }

  // From GitHub
  if (githubResult) {
    // Languages with >1000 bytes
    for (const [lang, bytes] of Object.entries(githubResult.languages)) {
      if (bytes > 1000) addSignal(lang, "github:languages");
    }
    // Frameworks/tools from dependency parsing
    for (const fw of githubResult.frameworks) addSignal(fw, `github:deps`);
    for (const tool of githubResult.tools) addSignal(tool, `github:deps`);
  }

  // From Apollo
  for (const item of apolloStack) {
    const normalized = normalizeApollo(item);
    if (normalized) addSignal(normalized, "apollo");
  }

  // Compute confidence
  const techStackSources: Record<string, string[]> = {};
  const stackConfidence: Record<string, "confirmed" | "likely" | "reported"> = {};

  for (const [tech, sources] of sourceMap) {
    const sourceArr = Array.from(sources);
    techStackSources[tech] = sourceArr;

    // Determine source categories present
    const hasJd = sourceArr.some((s) => s.startsWith("jd:"));
    const hasGithub = sourceArr.some((s) => s.startsWith("github:"));
    const hasApollo = sourceArr.some((s) => s === "apollo");

    const categoryCount = [hasJd, hasGithub, hasApollo].filter(Boolean).length;

    if (categoryCount >= 2 || hasJd || hasGithub) {
      stackConfidence[tech] = "confirmed";
    } else if (!hasApollo) {
      stackConfidence[tech] = "likely";
    } else {
      stackConfidence[tech] = "reported";
    }
  }

  // Sort: confirmed first, then likely, then reported. Alphabetical within.
  const order = { confirmed: 0, likely: 1, reported: 2 };
  const techStackVerified = Array.from(sourceMap.keys()).sort((a, b) => {
    const ca = order[stackConfidence[a]];
    const cb = order[stackConfidence[b]];
    if (ca !== cb) return ca - cb;
    return a.localeCompare(b);
  });

  return {
    techStackVerified,
    techStackSources,
    stackConfidence,
    jdCount: atsResult?.jobCount || 0,
  };
}
