import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { message, candidateContext, channel } = await request.json();

  if (!message?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  const contextLines: string[] = [];
  if (candidateContext) {
    if (candidateContext.name) contextLines.push(`Candidate: ${candidateContext.name}`);
    if (candidateContext.title) contextLines.push(`Title: ${candidateContext.title}`);
    if (candidateContext.company) contextLines.push(`Company: ${candidateContext.company}`);
    if (candidateContext.topRepos?.length) {
      contextLines.push(`Repos: ${candidateContext.topRepos.map((r: { name: string }) => r.name).join(", ")}`);
    }
    if (candidateContext.score) contextLines.push(`Scout Score: ${candidateContext.score}`);
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You improve recruiting outreach messages. Keep the recruiter's voice and structure but:
- Make the opening more specific to the candidate
- Tighten the body — remove filler words and vague statements
- Clarify the ask/CTA
- Keep word count equal or lower
- NEVER add "I came across your profile", "hope this finds you well", or "I'm reaching out because"
${channel === "text" ? "Keep under 160 characters." : channel === "linkedin" ? "Keep under 150 words." : "Keep under 100 words."}

Return ONLY valid JSON: { "body": "improved message", "subject_line": "improved subject or null" }`,
      messages: [{
        role: "user",
        content: `Improve this outreach message. Keep my voice but make it sharper.

${contextLines.length ? `CANDIDATE CONTEXT:\n${contextLines.join("\n")}\n` : ""}
ORIGINAL MESSAGE:
${message}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("Outreach improve error:", err);
    return Response.json({ error: "Failed to improve message" }, { status: 500 });
  }
}
