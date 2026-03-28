import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { stepNumber, otherMessages, candidateContext, channel, tone } = await request.json();

  if (stepNumber === undefined || !otherMessages) {
    return Response.json({ error: "Step number and other messages are required" }, { status: 400 });
  }

  const contextLines: string[] = [];
  if (candidateContext) {
    if (candidateContext.name) contextLines.push(`Candidate: ${candidateContext.name}`);
    if (candidateContext.title) contextLines.push(`Title: ${candidateContext.title}`);
    if (candidateContext.company) contextLines.push(`Company: ${candidateContext.company}`);
    if (candidateContext.topRepos?.length) {
      contextLines.push(`Repos: ${candidateContext.topRepos.map((r: { name: string }) => r.name).join(", ")}`);
    }
  }

  const otherMsgText = otherMessages
    .map((m: { step_number: number; body: string }) => `Step ${m.step_number}: ${m.body.slice(0, 100)}...`)
    .join("\n");

  const channelConstraint = channel === "text" ? "Under 160 characters." : channel === "linkedin" ? "Under 150 words." : stepNumber === 1 ? "Under 100 words." : "Under 60 words.";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You regenerate a single step in a recruiting outreach sequence. The new message must:
- Fit naturally in the sequence flow
- Use a DIFFERENT personalization angle from the other messages
- NEVER use "I came across your profile", "hope this finds you well", or "I'm reaching out because"
- ${channelConstraint}
- Tone: ${tone || "professional"}

Return ONLY valid JSON: { "body": "new message", "subject_line": "subject or null" }`,
      messages: [{
        role: "user",
        content: `Regenerate step ${stepNumber} of this outreach sequence. Use a different angle from the other messages.

${contextLines.length ? `CANDIDATE:\n${contextLines.join("\n")}\n` : ""}
OTHER MESSAGES IN SEQUENCE:
${otherMsgText}

Generate a new step ${stepNumber} (${stepNumber === 1 ? "initial outreach" : "follow-up"}).`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("Outreach regenerate-step error:", err);
    return Response.json({ error: "Failed to regenerate step" }, { status: 500 });
  }
}
