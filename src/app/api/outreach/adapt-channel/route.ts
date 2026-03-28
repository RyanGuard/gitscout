import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const anthropic = new Anthropic();
  const { message, subjectLine, fromChannel, toChannel, candidateContext } = await request.json();

  if (!message?.trim() || !toChannel) {
    return Response.json({ error: "Message and target channel are required" }, { status: 400 });
  }

  const channelSpecs: Record<string, string> = {
    email: "Email format: subject line (5-8 words) + body (under 100 words). Professional formatting.",
    linkedin: "LinkedIn InMail: under 150 words, no subject line needed for connection request (under 300 chars).",
    text: "Text/SMS: under 160 characters. Extremely concise. No subject line.",
  };

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: `You adapt recruiting outreach messages between channels (email, LinkedIn, text). Adjust length, formality, and format for the target channel while preserving the core message and personalization.

${channelSpecs[toChannel] || channelSpecs.email}

Return ONLY valid JSON: { "body": "adapted message", "subject_line": "subject or null" }`,
      messages: [{
        role: "user",
        content: `Convert this ${fromChannel || "email"} message to ${toChannel}.

${candidateContext?.name ? `Candidate: ${candidateContext.name}` : ""}
${subjectLine ? `Subject: ${subjectLine}\n` : ""}
MESSAGE:
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
    console.error("Outreach adapt-channel error:", err);
    return Response.json({ error: "Failed to adapt message" }, { status: 500 });
  }
}
