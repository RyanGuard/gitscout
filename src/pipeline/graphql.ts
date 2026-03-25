const GITHUB_GRAPHQL = "https://api.github.com/graphql";

export interface ContributionData {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  restrictedContributionsCount: number;
  totalContributions: number;
}

/**
 * Fetches a user's contribution data from GitHub's GraphQL API.
 *
 * Rate limit cost: ~1 point per query (out of 5,000/hour budget).
 * See: https://docs.github.com/en/graphql/overview/rate-limits-and-node-limits-for-the-graphql-api
 */
export async function fetchContributions(
  login: string
): Promise<ContributionData | null> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          restrictedContributionsCount
          contributionCalendar {
            totalContributions
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "GitScout/1.0",
      },
      body: JSON.stringify({ query, variables: { login } }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const cc = json?.data?.user?.contributionsCollection;
    if (!cc) return null;

    return {
      totalCommitContributions: cc.totalCommitContributions ?? 0,
      totalPullRequestContributions: cc.totalPullRequestContributions ?? 0,
      totalIssueContributions: cc.totalIssueContributions ?? 0,
      restrictedContributionsCount: cc.restrictedContributionsCount ?? 0,
      totalContributions: cc.contributionCalendar?.totalContributions ?? 0,
    };
  } catch {
    return null;
  }
}
