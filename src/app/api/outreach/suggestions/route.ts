import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidateContext } = await request.json();

  // Get user's analytics data
  const analytics = await prisma.outreachAnalytic.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const contextLines: string[] = [];
  if (candidateContext) {
    if (candidateContext.name) contextLines.push(`Candidate: ${candidateContext.name}`);
    if (candidateContext.title) contextLines.push(`Title: ${candidateContext.title}`);
    if (candidateContext.company) contextLines.push(`Company: ${candidateContext.company}`);
    if (candidateContext.seniority) contextLines.push(`Seniority: ${candidateContext.seniority}`);
    if (candidateContext.topRepos?.length) contextLines.push(`Has open source repos: yes`);
    if (candidateContext.connections?.length) contextLines.push(`Mutual connections: ${candidateContext.connections.length}`);
  }

  // Build analytics summary for Claude
  let analyticsContext = "No outreach history yet.";
  if (analytics.length >= 5) {
    const responded = analytics.filter((a) => a.responseReceived);
    const channels = [...new Set(analytics.map((a) => a.channel))];
    const tones = [...new Set(analytics.map((a) => a.tone))];
    analyticsContext = `Recruiter has sent ${analytics.length} outreach messages. ${responded.length} got responses (${Math.round((responded.length / analytics.length) * 100)}% rate).
Channels used: ${channels.join(", ")}
Tones used: ${tones.join(", ")}
${responded.filter((r) => r.usedOssReference).length > 0 ? `OSS references got ${Math.round((responded.filter((r) => r.usedOssReference).length / analytics.filter((a) => a.usedOssReference).length) * 100)}% response rate` : ""}`;
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You suggest outreach approaches for recruiters based on their past performance data and the candidate's profile. Be specific and actionable. Return ONLY valid JSON: { "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"], "recommendedChannel": "email|linkedin|text", "recommendedTone": "professional|casual|technical_peer|executive|warm_intro", "recommendedLength": 3 }`,
      messages: [{
        role: "user",
        content: `Suggest the best outreach approach for this candidate based on the recruiter's history.

CANDIDATE:
${contextLines.join("\n")}

RECRUITER ANALYTICS:
${analyticsContext}`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return Response.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error("Outreach suggestions error:", err);
    return Response.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
