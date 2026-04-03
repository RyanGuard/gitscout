import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const APOLLO_API = "https://api.apollo.io/api/v1";

interface Signal {
  type: string;
  impact: number;
  description: string;
}

interface ScoringResult {
  score: number;
  signals: Signal[];
  label: "likely" | "possible" | "unlikely";
}

/**
 * Fetch company-level signals from the MarketSignal model for a given domain.
 * Returns signals from any WatchedCompany matching the domain for this user.
 */
async function getCompanySignals(
  userId: string,
  domain: string
): Promise<Signal[]> {
  const signals: Signal[] = [];

  // Find watched companies for this domain belonging to the user
  const watchedCompanies = await prisma.watchedCompany.findMany({
    where: {
      userId,
      companyDomain: domain,
    },
    include: {
      signals: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 90 * 86400000), // last 90 days
          },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  for (const wc of watchedCompanies) {
    for (const signal of wc.signals) {
      const eventType = signal.eventType.toUpperCase();

      if (eventType === "LAYOFFS" || eventType === "REORG") {
        const impact =
          signal.severity === "high"
            ? 40
            : signal.severity === "medium"
              ? 25
              : 15;
        signals.push({
          type: "layoffs_reorg",
          impact,
          description: signal.summary,
        });
      } else if (eventType === "LEADERSHIP_CHANGE") {
        signals.push({
          type: "leadership_change",
          impact: 20,
          description: signal.summary,
        });
      } else if (eventType === "FUNDING") {
        signals.push({
          type: "funding_round",
          impact: -10,
          description: signal.summary,
        });
      }
    }
  }

  return signals;
}

/**
 * Check Apollo job postings for backfill signals.
 * If a company is heavily hiring for roles similar to existing ones, it may indicate instability.
 */
async function getJobPostingSignals(
  domain: string,
  userId: string
): Promise<Signal[]> {
  const signals: Signal[] = [];
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) return signals;

  // Look up the apollo org ID from watched companies
  const watchedCompany = await prisma.watchedCompany.findFirst({
    where: {
      userId,
      companyDomain: domain,
      apolloOrgId: { not: null },
    },
  });

  if (!watchedCompany?.apolloOrgId) return signals;

  // Check cache first (3-day TTL for job postings)
  const cacheKey = `job_postings:${domain}`;
  const cached = await prisma.enrichmentCache.findUnique({
    where: { cacheKey },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jobPostings: any[] = [];

  if (cached && cached.expiresAt > new Date()) {
    jobPostings = cached.data as typeof jobPostings;
  } else {
    try {
      const res = await fetch(
        `${APOLLO_API}/organizations/${watchedCompany.apolloOrgId}/job_postings`,
        {
          method: "GET",
          headers: { "X-Api-Key": apiKey },
        }
      );

      if (res.ok) {
        const data = await res.json();
        jobPostings = data.job_postings || [];

        // Cache for 3 days
        await prisma.enrichmentCache
          .upsert({
            where: { cacheKey },
            create: {
              cacheKey,
              cacheType: "job_postings",
              data: jobPostings as object,
              expiresAt: new Date(Date.now() + 3 * 86400000),
            },
            update: {
              data: jobPostings as object,
              expiresAt: new Date(Date.now() + 3 * 86400000),
            },
          })
          .catch(() => {});
      }
    } catch (err) {
      console.error("[open-to-move] Apollo job postings fetch failed:", err);
    }
  }

  if (jobPostings.length > 0) {
    // Many open roles in engineering can signal backfilling / instability
    const engineeringRoles = jobPostings.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (j: any) => {
        const title = (j.title || "").toLowerCase();
        return (
          title.includes("engineer") ||
          title.includes("developer") ||
          title.includes("architect") ||
          title.includes("sre") ||
          title.includes("devops") ||
          title.includes("platform")
        );
      }
    );

    if (engineeringRoles.length >= 10) {
      signals.push({
        type: "heavy_backfill",
        impact: 15,
        description: `Company has ${engineeringRoles.length} open engineering roles, suggesting potential backfilling or high turnover`,
      });
    } else if (engineeringRoles.length >= 5) {
      signals.push({
        type: "moderate_hiring",
        impact: 8,
        description: `Company has ${engineeringRoles.length} open engineering roles`,
      });
    }
  }

  return signals;
}

/**
 * Check for growth rate decline based on recent signal patterns.
 */
async function getGrowthDeclineSignals(
  userId: string,
  domain: string
): Promise<Signal[]> {
  const signals: Signal[] = [];

  // Count recent negative vs positive signals as a proxy for growth trajectory
  const watchedCompanies = await prisma.watchedCompany.findMany({
    where: { userId, companyDomain: domain },
    select: { id: true },
  });

  if (watchedCompanies.length === 0) return signals;

  const wcIds = watchedCompanies.map((wc) => wc.id);

  const [negativeCount, positiveCount] = await Promise.all([
    prisma.marketSignal.count({
      where: {
        watchedCompanyId: { in: wcIds },
        eventType: { in: ["LAYOFFS", "REORG", "LEADERSHIP_CHANGE"] },
        createdAt: { gte: new Date(Date.now() - 180 * 86400000) },
      },
    }),
    prisma.marketSignal.count({
      where: {
        watchedCompanyId: { in: wcIds },
        eventType: { in: ["FUNDING", "ACQUISITION"] },
        createdAt: { gte: new Date(Date.now() - 180 * 86400000) },
      },
    }),
  ]);

  if (negativeCount > positiveCount && negativeCount >= 2) {
    signals.push({
      type: "growth_declining",
      impact: 15,
      description: `Company shows ${negativeCount} negative signals vs ${positiveCount} positive signals in the last 6 months`,
    });
  }

  return signals;
}

/**
 * Calculate the final score and label from all collected signals.
 */
function calculateResult(signals: Signal[]): ScoringResult {
  // Sum impacts, clamped to 0-100
  const rawScore = signals.reduce((sum, s) => sum + s.impact, 0);
  const score = Math.max(0, Math.min(100, rawScore));

  let label: "likely" | "possible" | "unlikely";
  if (score >= 50) {
    label = "likely";
  } else if (score >= 25) {
    label = "possible";
  } else {
    label = "unlikely";
  }

  return { score, signals, label };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const domain = searchParams.get("domain");
  const developerId = searchParams.get("developerId");

  if (!domain && !developerId) {
    return NextResponse.json(
      { error: "Either domain or developerId query parameter is required" },
      { status: 400 }
    );
  }

  try {
    // --- Developer mode ---
    if (developerId) {
      const developer = await prisma.developer.findUnique({
        where: { id: developerId },
      });

      if (!developer) {
        return NextResponse.json(
          { error: "Developer not found" },
          { status: 404 }
        );
      }

      const allSignals: Signal[] = [];

      // Extract company domain from developer's company field if available
      const companyDomain = extractDomain(developer.company);

      // Apply company-level signals if we can identify their company
      if (companyDomain) {
        const [companySignals, jobSignals, growthSignals] = await Promise.all([
          getCompanySignals(session.user.id, companyDomain),
          getJobPostingSignals(companyDomain, session.user.id),
          getGrowthDeclineSignals(session.user.id, companyDomain),
        ]);
        allSignals.push(...companySignals, ...jobSignals, ...growthSignals);
      }

      // Individual developer signals
      const accountAgeDays = Math.floor(
        (Date.now() - new Date(developer.createdAt).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Recently created or active account
      if (accountAgeDays <= 365 || developer.recentActivity > 50) {
        allSignals.push({
          type: "recently_active",
          impact: 5,
          description:
            accountAgeDays <= 365
              ? "GitHub account created within the last year"
              : "High recent activity on GitHub",
        });
      }

      // Profile says hireable
      if (developer.hireable) {
        allSignals.push({
          type: "hireable_flag",
          impact: 20,
          description: "Developer has marked their GitHub profile as hireable",
        });
      }

      // Short tenure check — use Apollo employment data if cached
      if (companyDomain) {
        const tenureSignal = await checkShortTenure(developer.username);
        if (tenureSignal) {
          allSignals.push(tenureSignal);
        }
      }

      return NextResponse.json(calculateResult(allSignals));
    }

    // --- Company domain mode ---
    if (domain) {
      const [companySignals, jobSignals, growthSignals] = await Promise.all([
        getCompanySignals(session.user.id, domain),
        getJobPostingSignals(domain, session.user.id),
        getGrowthDeclineSignals(session.user.id, domain),
      ]);

      const allSignals = [...companySignals, ...jobSignals, ...growthSignals];
      return NextResponse.json(calculateResult(allSignals));
    }

    // Should not reach here, but just in case
    return NextResponse.json(
      { error: "Invalid request parameters" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[open-to-move] Scoring failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Open-to-move scoring failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Extract a company domain from a GitHub company field.
 * GitHub users often put "@company" or "Company Name" or "company.com".
 */
function extractDomain(company: string | null): string | null {
  if (!company) return null;

  const cleaned = company.replace(/^@/, "").trim();

  // If it already looks like a domain
  if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  // Common mapping: strip and try adding .com
  const slug = cleaned.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (slug.length > 0) {
    return `${slug}.com`;
  }

  return null;
}

/**
 * Check if the developer has a short tenure at their current company
 * by looking at cached Apollo enrichment data.
 */
async function checkShortTenure(username: string): Promise<Signal | null> {
  // Check if we have cached person enrichment data from Apollo
  const cacheKey = `person_enrichment:${username}`;
  const cached = await prisma.enrichmentCache.findUnique({
    where: { cacheKey },
  });

  if (!cached || cached.expiresAt < new Date()) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = cached.data as any;
  const employmentHistory = data?.employment_history || data?.person?.employment_history || [];

  if (employmentHistory.length === 0) return null;

  // The most recent employment entry
  const current = employmentHistory[0];
  if (!current?.start_date) return null;

  const startDate = new Date(current.start_date);
  const monthsAtCompany = Math.floor(
    (Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  if (monthsAtCompany < 18) {
    return {
      type: "short_tenure",
      impact: 10,
      description: `Developer has been at current company for approximately ${monthsAtCompany} months (< 18 months)`,
    };
  }

  return null;
}
