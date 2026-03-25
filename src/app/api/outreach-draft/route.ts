import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT =
  "You are an expert technical recruiter writing a cold outreach message to a developer. The message MUST reference specific projects, PRs, or technical work from their GitHub profile — never generic flattery. Keep it under 100 words. Casual but professional tone. End with a soft ask (open to a chat, not 'apply now'). Do not use exclamation marks excessively. Sound like a human, not a template.";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { username, profileData, roleContext, companyContext } = body;

  if (!username || !profileData) {
    return Response.json(
      { error: "username and profileData are required" },
      { status: 400 }
    );
  }

  // Build developer context
  const parts: string[] = [];
  parts.push(`Username: ${username}`);
  if (profileData.name) parts.push(`Name: ${profileData.name}`);
  if (profileData.bio) parts.push(`Bio: ${profileData.bio}`);
  if (profileData.location) parts.push(`Location: ${profileData.location}`);
  if (profileData.company) parts.push(`Current company: ${profileData.company}`);

  if (profileData.languages?.length > 0) {
    const langs = profileData.languages
      .slice(0, 6)
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
    parts.push(`Notable repos: ${repos}`);
  }

  if (profileData.totalStars != null)
    parts.push(`Total stars: ${profileData.totalStars}`);
  if (profileData.followers != null)
    parts.push(`Followers: ${profileData.followers}`);

  if (roleContext) parts.push(`Role being hired for: ${roleContext}`);
  if (companyContext) parts.push(`Hiring company: ${companyContext}`);

  const devContext = parts.join("\n");

  try {
    // Generate both variants in a single call
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Write two outreach message variants for this developer. Return ONLY a JSON object with two keys: "direct" and "soft". No markdown, no code fences, just the JSON object.

Direct approach: Lead with their specific technical work, pitch the opportunity.
Soft approach: Lead with genuine admiration for a specific project, mention you're building something related, ask for a conversation.

Developer info:
${devContext}`,
        },
      ],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "{}";

    // Parse the JSON response
    let variants: { direct: string; soft: string };
    try {
      variants = JSON.parse(rawText);
    } catch {
      // If JSON parsing fails, try to extract from the response
      const directMatch = rawText.match(/"direct"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const softMatch = rawText.match(/"soft"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      variants = {
        direct: directMatch
          ? directMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
          : rawText,
        soft: softMatch
          ? softMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
          : "",
      };
    }

    return Response.json({ variants: [variants.direct, variants.soft] });
  } catch (err) {
    console.error("Outreach draft generation failed:", err);
    return Response.json(
      { error: "Failed to generate outreach drafts" },
      { status: 500 }
    );
  }
}
