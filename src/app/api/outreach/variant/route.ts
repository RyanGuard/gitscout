import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";
import { logAiCall } from "@/lib/ai/logger";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropic = new Anthropic();
  const { sequenceId, stepNumber, candidateContext, channel, tone } = await request.json();

  if (!sequenceId || stepNumber == null) {
    return Response.json({ error: "sequenceId and stepNumber are required" }, { status: 400 });
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
    if (candidateContext.connections?.length) {
      contextLines.push(`Connections: ${candidateContext.connections.map((c: { name: string }) => c.name).join(", ")}`);
    }
  }

  const channelGuide =
    channel === "text"
      ? "Keep under 160 characters."
      : channel === "linkedin"
        ? "Keep under 150 words."
        : "Keep under 100 words for initial, under 60 for follow-up.";

  try {
    const aiStart = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 1.0,
      system: `You write recruiting outreach messages. Generate a COMPLETELY different approach for this step.
- Use a completely different opening angle, hook, and structure than typical messages
- NEVER use "I came across your profile", "hope this finds you well", or "I'm reaching out because"
- Must reference something specific about the candidate
- Tone: ${tone || "professional"}
- ${channelGuide}

Return ONLY valid JSON: { "body": "the message" }`,
      messages: [{
        role: "user",
        content: `Generate a COMPLETELY different approach for step ${stepNumber} of an outreach sequence.

${contextLines.length ? `CANDIDATE CONTEXT:\n${contextLines.join("\n")}\n` : ""}
Channel: ${channel || "email"}
Step: ${stepNumber}

Write a message that takes a totally unique angle — different structure, different hook, different value proposition emphasis.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    logAiCall(
      { userId: session.user.id, feature: "outreach_variant", metadata: { channel, stepNumber } },
      { inputTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, latencyMs: Date.now() - aiStart, success: true }
    ).catch(() => {});

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("Outreach variant error:", err);
    return Response.json({ error: "Failed to generate variant" }, { status: 500 });
  }
}
