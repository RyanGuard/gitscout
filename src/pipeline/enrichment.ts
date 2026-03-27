import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { enrichFromApollo } from "@/lib/apollo";
import type { ApolloPersonMatch } from "@/lib/apollo";
import { COMPANY_ALIASES } from "@/lib/company-aliases";

const GITHUB_API = "https://api.github.com";

// --- Seniority thresholds (easy to tune) ---
const SENIORITY_THRESHOLDS = {
  principal: { years: 10, commits: 5000, stars: 1000 },
  staff: { years: 10, commits: 5000, stars: 1000 },
  senior: { years: 6, commits: 1000, stars: 200 },
  mid: { years: 3, commits: 200, stars: 0 },
} as const;

// --- GitHub noreply patterns to filter ---
const NOREPLY_PATTERNS = [
  /noreply@github\.com$/i,
  /users\.noreply\.github\.com$/i,
  /github@users\.noreply\.github\.com$/i,
];

const URL_REGEX = /https?:\/\/[^\s,)]+/gi;

// --- GitHub API helpers ---

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Scout/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// --- Commit Email Mining ---

function isNoReplyEmail(email: string): boolean {
  if (!email || email === "") return true;
  if (email === "user@localhost" || email.endsWith("@localhost")) return true;
  return NOREPLY_PATTERNS.some((p) => p.test(email));
}

export async function mineCommitEmails(
  username: string,
  repos: string[],
): Promise<string[]> {
  const emails = new Set<string>();

  // Use top 3 repos by stars
  const topRepos = repos.slice(0, 3);

  for (const repoFullName of topRepos) {
    try {
      const res = await fetch(
        `${GITHUB_API}/repos/${repoFullName}/commits?author=${encodeURIComponent(username)}&per_page=5`,
        { headers: githubHeaders() },
      );
      if (!res.ok) continue;

      const commits = await res.json();
      for (const commit of commits) {
        const authorEmail = commit?.commit?.author?.email;
        const committerEmail = commit?.commit?.committer?.email;

        if (authorEmail && !isNoReplyEmail(authorEmail)) {
          emails.add(authorEmail.toLowerCase());
        }
        if (committerEmail && !isNoReplyEmail(committerEmail)) {
          emails.add(committerEmail.toLowerCase());
        }
      }
    } catch {
      // Continue with next repo if one fails
    }
  }

  return Array.from(emails);
}

// --- Company Normalization ---

export function normalizeCompany(rawCompany: string | null): string | null {
  if (!rawCompany || rawCompany.trim() === "") return null;

  // Step 1: Lowercase
  let cleaned = rawCompany.toLowerCase().trim();

  // Step 2: Remove leading @
  cleaned = cleaned.replace(/^@/, "");

  // Step 3: Remove trailing suffixes
  cleaned = cleaned
    .replace(/,?\s*(inc\.?|llc\.?|corp\.?|ltd\.?|co\.?|gmbh|ag|plc)$/i, "")
    .trim();

  // Step 4: Look up in aliases (try both with and without @ prefix)
  const aliasKey = cleaned;
  const aliasKeyWithAt = `@${cleaned}`;

  if (COMPANY_ALIASES[aliasKey]) return COMPANY_ALIASES[aliasKey];
  if (COMPANY_ALIASES[aliasKeyWithAt]) return COMPANY_ALIASES[aliasKeyWithAt];

  // Also try the original lowercased (before suffix removal)
  const originalLower = rawCompany.toLowerCase().trim();
  if (COMPANY_ALIASES[originalLower]) return COMPANY_ALIASES[originalLower];

  // Step 5: Title case the cleaned version
  if (cleaned === "") return null;
  return cleaned
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// --- Social Link Extraction ---

export interface SocialLinks {
  linkedinUrl: string | null;
  twitterUrl: string | null;
  mastodonUrl: string | null;
  devtoUrl: string | null;
  mediumUrl: string | null;
  personalSite: string | null;
}

export function extractSocialLinks(
  bio: string | null,
  blog: string | null,
): SocialLinks {
  const links: SocialLinks = {
    linkedinUrl: null,
    twitterUrl: null,
    mastodonUrl: null,
    devtoUrl: null,
    mediumUrl: null,
    personalSite: null,
  };

  const allText = [bio, blog].filter(Boolean).join(" ");
  const urls = allText.match(URL_REGEX) || [];

  for (const rawUrl of urls) {
    // Clean trailing punctuation
    const url = rawUrl.replace(/[.),;]+$/, "");

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();

      if (host.includes("linkedin.com")) {
        links.linkedinUrl = url;
      } else if (host === "twitter.com" || host === "x.com") {
        links.twitterUrl = url;
      } else if (host === "dev.to") {
        links.devtoUrl = url;
      } else if (host === "medium.com") {
        links.mediumUrl = url;
      } else if (
        host.includes("mastodon") ||
        parsed.pathname.startsWith("/@")
      ) {
        // Mastodon instances often have /@handle paths
        links.mastodonUrl = url;
      } else if (
        !host.includes("github.com") &&
        !host.includes("github.io")
      ) {
        // Personal site: anything that isn't GitHub/LinkedIn/Twitter/etc
        if (!links.personalSite) {
          links.personalSite = url;
        }
      }
    } catch {
      // Invalid URL, skip
    }
  }

  // If blog is a plain domain (no scheme matched above), classify it
  if (blog && !blog.startsWith("http")) {
    const withScheme = `https://${blog}`;
    try {
      const parsed = new URL(withScheme);
      const host = parsed.hostname.toLowerCase();
      if (host.includes("linkedin.com") && !links.linkedinUrl) {
        links.linkedinUrl = withScheme;
      } else if (
        (host === "twitter.com" || host === "x.com") &&
        !links.twitterUrl
      ) {
        links.twitterUrl = withScheme;
      } else if (host === "dev.to" && !links.devtoUrl) {
        links.devtoUrl = withScheme;
      } else if (host === "medium.com" && !links.mediumUrl) {
        links.mediumUrl = withScheme;
      } else if (!links.personalSite) {
        links.personalSite = withScheme;
      }
    } catch {
      // Invalid, skip
    }
  }

  return links;
}

// --- Seniority Inference ---

interface DeveloperForSeniority {
  createdAt: Date;
  totalCommits: number;
  totalStars: number;
  followers: number;
}

export function inferSeniority(developer: DeveloperForSeniority): string {
  const now = new Date();
  const accountAge =
    (now.getTime() - developer.createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

  const { totalCommits, totalStars } = developer;

  if (
    accountAge >= SENIORITY_THRESHOLDS.principal.years &&
    totalCommits >= SENIORITY_THRESHOLDS.principal.commits &&
    totalStars >= SENIORITY_THRESHOLDS.principal.stars
  ) {
    // Distinguish staff vs principal by follower count
    if (developer.followers >= 500) return "principal";
    return "staff";
  }

  if (
    accountAge >= SENIORITY_THRESHOLDS.senior.years &&
    totalCommits >= SENIORITY_THRESHOLDS.senior.commits &&
    totalStars >= SENIORITY_THRESHOLDS.senior.stars
  ) {
    return "senior";
  }

  if (
    accountAge >= SENIORITY_THRESHOLDS.mid.years &&
    totalCommits >= SENIORITY_THRESHOLDS.mid.commits
  ) {
    return "mid";
  }

  return "junior";
}

// --- Main Enrichment Orchestrator ---

export async function enrichDeveloper(developerId: string) {
  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    include: {
      repositories: {
        orderBy: { stars: "desc" },
        take: 3,
      },
    },
  });

  if (!developer) {
    throw new Error(`Developer not found: ${developerId}`);
  }

  // Step 1: Mine commit emails
  const repoFullNames = developer.repositories.map((r) => r.fullName);
  const minedEmails = await mineCommitEmails(developer.username, repoFullNames);

  // Step 2: Extract social links from bio/blog
  const socialLinks = extractSocialLinks(developer.bio, developer.blog);

  // Also check twitterUsername field
  if (developer.twitterUsername && !socialLinks.twitterUrl) {
    socialLinks.twitterUrl = `https://twitter.com/${developer.twitterUsername}`;
  }

  // Step 3: Call Apollo with best available data
  const bestEmail = minedEmails[0] || developer.email || null;
  let apolloResult: ApolloPersonMatch | null = null;

  try {
    apolloResult = await enrichFromApollo({
      name: developer.name,
      company: developer.company,
      email: bestEmail,
      linkedinUrl: socialLinks.linkedinUrl,
      githubUsername: developer.username,
    });
  } catch {
    // Apollo failed — continue with GitHub-only enrichment
    console.error(
      `[enrichment] Apollo failed for ${developer.username}, using GitHub-only data`,
    );
  }

  // Step 4: Normalize company
  const normalizedCompany = apolloResult?.organization_name
    ? normalizeCompany(apolloResult.organization_name)
    : normalizeCompany(developer.company);

  // Step 5: Infer seniority
  const inferredSeniority = inferSeniority(developer);

  // Merge all sources — Apollo takes priority
  const allEmails = new Set<string>(minedEmails);
  if (apolloResult?.email) allEmails.add(apolloResult.email.toLowerCase());
  if (developer.email) allEmails.add(developer.email.toLowerCase());
  const emailsArray = Array.from(allEmails);

  const primaryEmail =
    apolloResult?.email || emailsArray[0] || null;

  const enrichmentSource = apolloResult ? "apollo" : "github";

  const contactData = {
    emails: emailsArray,
    primaryEmail,
    phone: apolloResult?.phone_numbers?.[0]?.sanitized_number || null,
    linkedinUrl: apolloResult?.linkedin_url || socialLinks.linkedinUrl,
    twitterUrl: apolloResult?.twitter_url || socialLinks.twitterUrl,
    mastodonUrl: socialLinks.mastodonUrl,
    devtoUrl: socialLinks.devtoUrl,
    mediumUrl: socialLinks.mediumUrl,
    personalSite: socialLinks.personalSite,
    photoUrl: apolloResult?.photo_url || null,
    currentTitle: apolloResult?.title || null,
    headline: apolloResult?.headline || null,
    normalizedCompany,
    seniorityLevel: apolloResult?.seniority || inferredSeniority,
    employmentHistory: apolloResult?.employment_history
      ? (apolloResult.employment_history as unknown as Prisma.InputJsonValue)
      : Prisma.JsonNull,
    apolloId: apolloResult?.id || null,
    enrichedAt: new Date(),
    enrichmentSource,
  };

  const contactInfo = await prisma.contactInfo.upsert({
    where: { developerId },
    create: {
      developerId,
      ...contactData,
    },
    update: contactData,
  });

  return contactInfo;
}
