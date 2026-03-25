export async function GET() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return Response.json({ error: "No GITHUB_TOKEN" });

  const tokenType = token.startsWith("ghp_") ? "classic" : token.startsWith("github_pat_") ? "fine-grained" : "unknown";

  // Test GraphQL
  const query = `query { user(login: "torvalds") { contributionsCollection { totalCommitContributions contributionCalendar { totalContributions } } } }`;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const json = await res.json();
    return Response.json({
      tokenType,
      tokenPrefix: token.slice(0, 10),
      graphqlStatus: res.status,
      hasErrors: !!json.errors,
      errors: json.errors || null,
      commits: json?.data?.user?.contributionsCollection?.totalCommitContributions ?? "NULL",
      totalContributions: json?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions ?? "NULL",
    });
  } catch (e) {
    return Response.json({ tokenType, error: e instanceof Error ? e.message : "unknown" });
  }
}
