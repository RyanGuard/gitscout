// GitHub GraphQL + Search API for deep developer signals
// Enhanced query cost: ~2 points out of 5,000/hour budget
// Merged PR search: 1 search API call (30/min limit)
// Requires GITHUB_TOKEN env var

const GITHUB_GRAPHQL = "https://api.github.com/graphql";
const GITHUB_API = "https://api.github.com";

export interface ContributionData {
  // Core counts
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalPullRequestReviewContributions: number;
  totalIssueContributions: number;
  restrictedContributionsCount: number;
  totalContributions: number;

  // Calendar analysis
  activeWeeks: number;    // Weeks with at least 1 contribution
  totalWeeks: number;     // Total weeks in the period
  consistencyRatio: number; // activeWeeks / totalWeeks

  // Sponsorship
  isSponsorable: boolean;
  sponsorCount: number;

  // Merged PRs to external repos (the #1 signal)
  externalMergedPRs: number;
}

function githubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "GitScout/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

// Fetch merged PRs to repos the user doesn't own — the gold standard signal
async function fetchExternalMergedPRs(login: string): Promise<number> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return 0;

  try {
    const q = `author:${login} is:pr is:merged -user:${login}`;
    const res = await fetch(
      `${GITHUB_API}/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
      { headers: githubHeaders() }
    );
    if (!res.ok) return 0;
    const data = await res.json();
    return data.total_count ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchContributions(
  login: string
): Promise<ContributionData | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  // Enhanced GraphQL query — PR reviews, full calendar, sponsorship
  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          totalIssueContributions
          restrictedContributionsCount
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                contributionCount
              }
            }
          }
        }
        sponsorshipsAsMaintainer(first: 1) {
          totalCount
        }
        isSponsorable
      }
    }
  `;

  try {
    // Run GraphQL and merged PR search in parallel
    const [graphqlRes, externalPRs] = await Promise.all([
      fetch(GITHUB_GRAPHQL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables: { login } }),
      }),
      fetchExternalMergedPRs(login),
    ]);

    if (!graphqlRes.ok) {
      console.error(`[graphql] HTTP ${graphqlRes.status} for ${login}`);
      return null;
    }

    const json = await graphqlRes.json();

    if (json.errors) {
      console.error(`[graphql] Errors for ${login}:`, JSON.stringify(json.errors));
    }

    const user = json?.data?.user;
    if (!user) {
      console.error(`[graphql] No user data for ${login}. Response:`, JSON.stringify(json).slice(0, 200));
      return null;
    }

    const cc = user.contributionsCollection;
    if (!cc) {
      console.error(`[graphql] No contributionsCollection for ${login}`);
      return null;
    }

    // Analyze contribution calendar for consistency
    const weeks = cc.contributionCalendar?.weeks || [];
    const totalWeeks = weeks.length;
    let activeWeeks = 0;
    for (const week of weeks) {
      const weekTotal = (week.contributionDays || []).reduce(
        (s: number, d: { contributionCount: number }) => s + d.contributionCount,
        0
      );
      if (weekTotal > 0) activeWeeks++;
    }

    return {
      totalCommitContributions: cc.totalCommitContributions ?? 0,
      totalPullRequestContributions: cc.totalPullRequestContributions ?? 0,
      totalPullRequestReviewContributions: cc.totalPullRequestReviewContributions ?? 0,
      totalIssueContributions: cc.totalIssueContributions ?? 0,
      restrictedContributionsCount: cc.restrictedContributionsCount ?? 0,
      totalContributions: cc.contributionCalendar?.totalContributions ?? 0,
      activeWeeks,
      totalWeeks,
      consistencyRatio: totalWeeks > 0 ? activeWeeks / totalWeeks : 0,
      isSponsorable: user.isSponsorable ?? false,
      sponsorCount: user.sponsorshipsAsMaintainer?.totalCount ?? 0,
      externalMergedPRs: externalPRs,
    };
  } catch (err) {
    console.error(`[graphql] Exception for ${login}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
