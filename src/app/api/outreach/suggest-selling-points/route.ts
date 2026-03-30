import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });
  }

  const anthropic = new Anthropic();

  const body = await request.json();
  const { candidateContext, roleContext } = body;

  if (!candidateContext) {
    return Response.json({ error: "Candidate context is required" }, { status: 400 });
  }

  // Build candidate info
  const candidateInfo: string[] = [];
  if (candidateContext.name) candidateInfo.push(`Name: ${candidateContext.name}`);
  if (candidateContext.title) candidateInfo.push(`Title: ${candidateContext.title}`);
  if (candidateContext.company) candidateInfo.push(`Company: ${candidateContext.company}`);
  if (candidateContext.topRepos?.length) {
    candidateInfo.push(`Top repositories: ${candidateContext.topRepos.map((r: { name: string; stars: number; language: string }) => `${r.name} (${r.stars}\u2605, ${r.language})`).join(", ")}`);
  }
  if (candidateContext.languages?.length) {
    candidateInfo.push(`Programming languages: ${candidateContext.languages.join(", ")}`);
  }
  if (candidateContext.score) candidateInfo.push(`Scout Score: ${candidateContext.score}/100`);
  if (candidateContext.tier) candidateInfo.push(`Tier: ${candidateContext.tier}`);
  if (candidateContext.flightRisk) candidateInfo.push(`Flight risk: ${candidateContext.flightRisk}`);
  if (candidateContext.flightRiskSignals?.length) {
    candidateInfo.push(`Flight risk signals: ${candidateContext.flightRiskSignals.join(", ")}`);
  }

  // Build role info
  const roleInfo: string[] = [];
  if (roleContext) {
    if (roleContext.title) roleInfo.push(`Role: ${roleContext.title}`);
    if (roleContext.company) roleInfo.push(`Company: ${roleContext.company}`);
    if (roleContext.payRange?.min) roleInfo.push(`Compensation: $${roleContext.payRange.min}-$${roleContext.payRange.max}`);
    if (roleContext.workModel) roleInfo.push(`Work model: ${roleContext.workModel}`);
    if (roleContext.techStack?.length) roleInfo.push(`Tech stack: ${roleContext.techStack.join(", ")}`);
    if (roleContext.teamSize) roleInfo.push(`Team size: ${roleContext.teamSize}`);
    if (roleContext.stage) roleInfo.push(`Company stage: ${roleContext.stage}`);
    if (roleContext.recentNews) roleInfo.push(`Recent news: ${roleContext.recentNews}`);
  }

  const systemPrompt = `You are a recruiting strategist. Given a candidate profile and a role, suggest 3-5 specific, compelling selling points that would resonate with THIS candidate. Focus on what's in it for them. Return JSON: { points: string[] }`;

  const userPrompt = `CANDIDATE:
${candidateInfo.join("\n")}

${roleInfo.length ? `ROLE:\n${roleInfo.join("\n")}` : ""}

Suggest 3-5 selling points that would resonate with this specific candidate.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);

    return Response.json({ points: result.points });
  } catch (err) {
    console.error("Suggest selling points error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Suggestion failed: ${message}` }, { status: 500 });
  }
}
