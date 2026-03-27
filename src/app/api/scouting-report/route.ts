import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT =
  "You are a senior technical recruiter writing a brief scouting report for a hiring manager. Be specific, cite actual data, and focus on signals that indicate engineering quality. Keep it to 3-4 sentences. Never fabricate data — only reference what's provided.";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { username, profileData, scoreData } = body;

  if (!username || !profileData) {
    return Response.json(
      { error: "username and profileData are required" },
      { status: 400 }
    );
  }

  // Build a rich user message from profile data
  const parts: string[] = [];
  parts.push(`Username: ${username}`);
  if (profileData.name) parts.push(`Name: ${profileData.name}`);
  if (profileData.bio) parts.push(`Bio: ${profileData.bio}`);
  if (profileData.location) parts.push(`Location: ${profileData.location}`);
  if (profileData.company) parts.push(`Company: ${profileData.company}`);
  if (profileData.followers != null)
    parts.push(`Followers: ${profileData.followers}`);
  if (profileData.totalStars != null)
    parts.push(`Total stars earned: ${profileData.totalStars}`);
  if (profileData.publicRepos != null)
    parts.push(`Public repos: ${profileData.publicRepos}`);

  if (profileData.languages?.length > 0) {
    const langs = profileData.languages
      .slice(0, 8)
      .map(
        (l: { language: string; percentage: number }) =>
          `${l.language} (${Math.round(l.percentage)}%)`
      )
      .join(", ");
    parts.push(`Top languages: ${langs}`);
  }

  if (profileData.repositories?.length > 0) {
    const repos = profileData.repositories
      .slice(0, 5)
      .map(
        (r: { name: string; stars: number; language: string | null; description: string | null }) =>
          `${r.name} (${r.stars} stars${r.language ? `, ${r.language}` : ""}${r.description ? ` — ${r.description}` : ""})`
      )
      .join("; ");
    parts.push(`Top repos: ${repos}`);
  }

  if (scoreData) {
    if (scoreData.score != null) parts.push(`Scout score: ${scoreData.score}/100`);
    if (scoreData.tier) parts.push(`Tier: ${scoreData.tier}`);
    if (scoreData.totalCommits != null)
      parts.push(`Total commits (last 12 months): ${scoreData.totalCommits}`);
    if (scoreData.externalMergedPRs != null)
      parts.push(`Merged PRs to external repos: ${scoreData.externalMergedPRs}`);
    if (scoreData.recentActivity != null)
      parts.push(`Recent contributions (last 12 months): ${scoreData.recentActivity}`);
    if (scoreData.impactScore != null)
      parts.push(
        `Score breakdown — Impact: ${scoreData.impactScore}/10, Contribution: ${scoreData.contributionScore}/10, Consistency: ${scoreData.consistencyScore}/10, Technical: ${scoreData.technicalScore}/10, Reputation: ${scoreData.reputationScore}/10`
      );
  }

  if (profileData.hireable) parts.push("Hireable: yes");
  if (profileData.createdAt) parts.push(`Account created: ${profileData.createdAt}`);

  const userMessage = parts.join("\n");

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const report =
      message.content[0].type === "text" ? message.content[0].text : "";

    return Response.json({ report });
  } catch (err) {
    console.error("Scouting report generation failed:", err);
    return Response.json(
      { error: "Failed to generate scouting report" },
      { status: 500 }
    );
  }
}
