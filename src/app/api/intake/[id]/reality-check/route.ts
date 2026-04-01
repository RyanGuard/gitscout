import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await prisma.intakeSession.findUnique({ where: { id } });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (session.status !== "complete" && session.status !== "map_generated") {
    return Response.json({ error: "Intake must be complete before reality check" }, { status: 400 });
  }

  const rb = session.roleBasics as Record<string, unknown> | null;
  const cp = session.candidateProfile as Record<string, unknown> | null;
  const tr = session.technicalReqs as Record<string, unknown> | null;
  const comp = session.compensation as Record<string, unknown> | null;
  const log = session.logistics as Record<string, unknown> | null;
  const rf = session.redFlags as Record<string, unknown> | null;
  const ss = session.sourcingStrategy as Record<string, unknown> | null;

  const brief = `Role: ${rb?.title || "Unknown"} (${rb?.level || "unknown level"})
Department: ${rb?.department || "unspecified"}
Team size: ${rb?.teamSize || "unknown"}
${rb?.isBackfill ? `Backfill — previous person left: ${rb?.backfillReason || "reason unknown"}` : "New headcount"}
Responsibilities: ${rb?.responsibilities || "not specified"}

Must-haves: ${(cp?.mustHaves as string[])?.join(", ") || "none listed"}
Nice-to-haves: ${(cp?.niceToHaves as string[])?.join(", ") || "none listed"}
Years experience: ${cp?.yearsExperience || "not specified"}

Tech stack: ${[...(tr?.languages as string[] || []), ...(tr?.frameworks as string[] || []), ...(tr?.tools as string[] || [])].join(", ") || "not specified"}
System design: ${tr?.systemDesign || "not specified"}

Compensation: ${comp?.min ? `$${(comp.min as number).toLocaleString()}` : "?"} - ${comp?.max ? `$${(comp.max as number).toLocaleString()}` : "?"}
Equity: ${comp?.equity ? "Yes" : "No"}

Location: ${log?.location || "not specified"}
Remote: ${log?.remote ? "Yes" : "No"}, Hybrid: ${log?.hybrid ? "Yes" : "No"}, Onsite: ${log?.onsite ? "Yes" : "No"}
Visa: ${log?.visaSponsorship ? "Will sponsor" : "No sponsorship"}

Disqualifiers: ${(rf?.disqualifiers as string[])?.join(", ") || "none"}
Non-negotiables: ${(rf?.nonNegotiables as string[])?.join(", ") || "none"}

Target companies: ${(ss?.targetCompanies as string[])?.join(", ") || "none"}
Avoid companies: ${(ss?.avoidCompanies as string[])?.join(", ") || "none"}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `You are a recruiting market intelligence analyst. Given structured intake data for a technical role, provide an honest reality check. Be direct.

Analyze:
1. MARKET SIZE: Estimate talent pool. "very small (<100)", "small (100-500)", "moderate (500-2000)", "large (2000+)"
2. COMP COMPETITIVENESS: Is compensation competitive? If below market, say so with estimate.
3. REQUIREMENT CONFLICTS: Flag contradictory or unusually restrictive requirements.
4. DIFFICULTY SCORE: 1-5. 1=easy, 5=very difficult.
5. SUGGESTIONS: 3-5 actionable suggestions with estimated impact.
6. TIMELINE ESTIMATE: How long should this search take?

Respond in JSON:
{
  "marketSize": "string with reasoning",
  "compAnalysis": "string",
  "conflicts": ["array of concerns"],
  "difficultyScore": "number 1-5",
  "suggestions": [{"suggestion": "string", "impact": "string"}],
  "timelineEstimate": "string",
  "overallAssessment": "string — 2-3 sentence bottom line"
}`,
      messages: [{ role: "user", content: brief }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(text);
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) result = JSON.parse(match[1]);
      else return Response.json({ error: "Failed to parse reality check" }, { status: 500 });
    }

    await prisma.intakeSession.update({
      where: { id },
      data: { realityCheck: result as object },
    });

    return Response.json(result);
  } catch (error) {
    console.error("[intake/reality-check] Failed:", error);
    return Response.json({ error: "Reality check failed" }, { status: 500 });
  }
}
