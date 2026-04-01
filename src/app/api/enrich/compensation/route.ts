import { estimateCompensation } from "@/lib/enrichment/compensation";
import { safeErrorMessage } from "@/lib/api-error";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return Response.json({ error: "username required" }, { status: 400 });
  }

  // Fetch GitHub profile to get signals
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Scout/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(`https://api.github.com/users/${username}`, { headers });
    if (!res.ok) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const user = await res.json();
    const accountAge = user.created_at
      ? (Date.now() - new Date(user.created_at).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      : 0;

    const estimate = estimateCompensation({
      accountAgeYears: accountAge,
      followers: user.followers,
      publicRepos: user.public_repos,
      location: user.location,
      company: user.company,
    });

    return Response.json({
      username: user.login,
      ...estimate,
      disclaimer: "Estimates based on public market data. Not actual salary information.",
    });
  } catch (error) {
    return Response.json(
      { error: safeErrorMessage(error, "Estimation failed") },
      { status: 500 }
    );
  }
}
