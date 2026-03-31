import { parseJobDescription } from "@/lib/jd-parser";
import { generateBoardSlugs } from "./slugGenerator";

export interface ATSScanResult {
  source: "greenhouse" | "lever";
  boardToken: string;
  jobCount: number;
  mergedTech: { languages: string[]; frameworks: string[]; tools: string[] };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function tryGreenhouse(slug: string): Promise<ATSScanResult | null> {
  try {
    const res = await fetch(
      `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const jobs: Array<{ content?: string }> = data.jobs || [];
    if (jobs.length === 0) return null;

    const allLanguages = new Set<string>();
    const allFrameworks = new Set<string>();
    const allTools = new Set<string>();

    const cap = Math.min(jobs.length, 30);
    for (let i = 0; i < cap; i++) {
      const text = stripHtml(jobs[i].content || "");
      if (!text) continue;
      const parsed = parseJobDescription(text);
      parsed.languages.forEach((l) => allLanguages.add(l));
      parsed.frameworks.forEach((f) => allFrameworks.add(f));
      parsed.tools.forEach((t) => allTools.add(t));
    }

    return {
      source: "greenhouse",
      boardToken: slug,
      jobCount: jobs.length,
      mergedTech: {
        languages: Array.from(allLanguages),
        frameworks: Array.from(allFrameworks),
        tools: Array.from(allTools),
      },
    };
  } catch {
    return null;
  }
}

async function tryLever(slug: string): Promise<ATSScanResult | null> {
  try {
    const res = await fetch(
      `https://api.lever.co/v0/postings/${slug}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const postings: Array<{
      descriptionPlain?: string;
      lists?: Array<{ content?: string }>;
    }> = await res.json();
    if (!Array.isArray(postings) || postings.length === 0) return null;

    const allLanguages = new Set<string>();
    const allFrameworks = new Set<string>();
    const allTools = new Set<string>();

    const cap = Math.min(postings.length, 30);
    for (let i = 0; i < cap; i++) {
      const p = postings[i];
      let text = p.descriptionPlain || "";
      if (p.lists) {
        text += " " + p.lists.map((l) => l.content || "").join(" ");
      }
      text = stripHtml(text);
      if (!text) continue;
      const parsed = parseJobDescription(text);
      parsed.languages.forEach((l) => allLanguages.add(l));
      parsed.frameworks.forEach((f) => allFrameworks.add(f));
      parsed.tools.forEach((t) => allTools.add(t));
    }

    return {
      source: "lever",
      boardToken: slug,
      jobCount: postings.length,
      mergedTech: {
        languages: Array.from(allLanguages),
        frameworks: Array.from(allFrameworks),
        tools: Array.from(allTools),
      },
    };
  } catch {
    return null;
  }
}

/**
 * Scans Greenhouse and Lever public job boards for a company's tech stack.
 */
export async function scanATSBoards(
  companyName: string,
  companyDomain: string
): Promise<ATSScanResult | null> {
  const slugs = generateBoardSlugs(companyName, companyDomain);

  // Try Greenhouse first
  for (const slug of slugs) {
    const result = await tryGreenhouse(slug);
    if (result) return result;
  }

  // Fallback to Lever
  for (const slug of slugs) {
    const result = await tryLever(slug);
    if (result) return result;
  }

  return null;
}
