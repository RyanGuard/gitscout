// Quick Search Pipeline — Fast path using GitHub Search Users API
// Returns results in 1-2 seconds. Lower quality but immediate.

import { getGitHubClient } from "@/lib/github/client";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    language,
    location,
    minFollowers = 10,
    minRepos = 5,
    sort = "followers",
    perPage = 30,
    page = 1,
    query: freeText,
  } = body;

  const client = getGitHubClient();

  // Build GitHub search query
  // Split multi-word queries and keep only the top 2 most specific terms
  // to avoid overly restrictive AND matching on GitHub
  const parts: string[] = [];
  if (freeText) {
    const fillerWords = new Set(["the", "a", "an", "and", "or", "for", "in", "of", "with", "at", "to", "engineer", "engineering", "developer", "infrastructure", "senior", "staff", "principal", "junior", "lead"]);
    const words = freeText.trim().split(/\s+/).filter((w: string) => !fillerWords.has(w.toLowerCase()));
    // Use at most 2 technical keywords to avoid zero-result AND queries
    const keywords = words.length > 2 ? words.slice(0, 2) : words;
    if (keywords.length > 0) parts.push(keywords.join(" "));
  }
  if (language) parts.push(`language:${language}`);
  if (location) parts.push(`location:"${location}"`);
  parts.push(`followers:>${minFollowers}`);
  parts.push(`repos:>${minRepos}`);
  parts.push("type:user");

  const ghQuery = parts.join("+");
  const searchResult = await client.searchUsers(ghQuery, sort, perPage, page);

  // Fetch basic profiles in parallel (search results have limited data)
  const items = searchResult.items || [];
  const profiles = await Promise.all(
    items.map(async (item: { login: string; id: number; avatar_url: string }) => {
      const user = await client.getUser(item.login);
      if (!user) return null;

      const accountAge = Math.floor(
        (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        username: user.login,
        displayName: user.name || user.login,
        avatarUrl: user.avatar_url,
        bio: user.bio || "",
        location: user.location || "",
        email: user.email || null,
        company: user.company || null,
        hireable: user.hireable ?? null,
        followers: user.followers,
        following: user.following,
        publicRepos: user.public_repos,
        createdAt: user.created_at,
        profileUrl: `https://github.com/${user.login}`,
        source: "quick" as const,
        quickScore: {
          followers: user.followers,
          repos: user.public_repos,
          accountAgeDays: accountAge,
          hasEmail: !!user.email,
          isHireable: !!user.hireable,
        },
      };
    })
  );

  const developers = profiles.filter(Boolean);

  return Response.json({
    total_count: searchResult.total_count || 0,
    developers,
  });
}
