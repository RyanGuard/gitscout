import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { connection_id } = body;

  if (!connection_id) {
    return Response.json(
      { error: "connection_id is required" },
      { status: 400 }
    );
  }

  const connection = await prisma.connection.findUnique({
    where: { id: connection_id },
    include: {
      lookup: {
        select: { targetCompanyName: true, userId: true },
      },
    },
  });

  if (!connection || connection.lookup.userId !== session.user.id) {
    return Response.json({ error: "Connection not found" }, { status: 404 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const prompt = `You are writing a short, warm internal message from a recruiter to their colleague, asking the colleague to make an introduction to someone at a target company.

Context:
- Recruiter's colleague: ${connection.homePersonName}, ${connection.homePersonTitle}
- Target person: ${connection.targetPersonName}, ${connection.targetPersonTitle} at ${connection.lookup.targetCompanyName}
- Connection type: ${connection.connectionType}
- Connection detail: ${JSON.stringify(connection.detail)}

Write a brief, professional but friendly internal message (like a Slack DM or short email) from the recruiter to ${connection.homePersonName} asking them to introduce the recruiter to ${connection.targetPersonName}. Reference the specific shared connection (former colleague, shared school, etc.) to make the ask natural.

Keep it under 100 words. Be specific about the connection. Don't be overly formal.

Respond ONLY in JSON:
{
  "subject": "Quick intro request",
  "body": "..."
}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      return Response.json({ error: "AI generation failed" }, { status: 500 });
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return Response.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return Response.json({
      subject: parsed.subject,
      body: parsed.body,
    });
  } catch (error) {
    console.error("[connections] Draft intro error:", error);
    return Response.json(
      { error: "Failed to generate intro draft" },
      { status: 500 }
    );
  }
}
