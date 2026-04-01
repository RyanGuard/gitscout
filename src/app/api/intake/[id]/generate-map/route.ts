import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const intake = await prisma.intakeSession.findUnique({ where: { id } });
  if (!intake) return Response.json({ error: "Not found" }, { status: 404 });
  if (intake.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (intake.status !== "complete") {
    return Response.json({ error: "Intake must be complete before generating a map" }, { status: 400 });
  }

  const rb = (intake.roleBasics as Record<string, unknown>) || {};
  const cp = (intake.candidateProfile as Record<string, unknown>) || {};
  const tr = (intake.technicalReqs as Record<string, unknown>) || {};
  const comp = (intake.compensation as Record<string, unknown>) || {};
  const log = (intake.logistics as Record<string, unknown>) || {};
  const sp = (intake.sellingPoints as Record<string, unknown>) || {};
  const ss = (intake.sourcingStrategy as Record<string, unknown>) || {};

  const roleTitle = (rb.title as string) || "Software Engineer";
  const roleLevel = (rb.level as string) || null;
  const languages = (tr.languages as string[]) || [];
  const frameworks = (tr.frameworks as string[]) || [];
  const tools = (tr.tools as string[]) || [];
  const roleStack = [...languages, ...frameworks, ...tools].slice(0, 10);
  const geography = (log.location as string) || null;
  const roleDescription = (rb.responsibilities as string) || null;
  const compMin = (comp.min as number) || null;
  const compMax = (comp.max as number) || null;
  const targetCompanies = (ss.targetCompanies as string[]) || [];
  const avoidCompanies = (ss.avoidCompanies as string[]) || [];
  const mustHaves = (cp.mustHaves as string[]) || [];
  const niceToHaves = (cp.niceToHaves as string[]) || [];
  const isBackfill = rb.isBackfill as boolean;
  const backfillReason = (rb.backfillReason as string) || null;
  const teamSize = rb.teamSize as number | null;
  const reportingTo = (rb.reportingTo as string) || null;
  const systemDesign = (tr.systemDesign as string) || null;
  const personality = (cp.personality as string) || null;

  try {
    // Create market map
    const map = await prisma.marketMap.create({
      data: {
        userId,
        name: `${roleTitle} Market Map`,
        roleTitle,
        roleLevel,
        roleStack,
        roleDescription,
        geography: geography ? [geography] : [],
        compRangeMin: compMin,
        compRangeMax: compMax,
        status: "generating",
      },
    });

    // Build enriched prompt
    const userMessage = `Find companies for this role: ${roleTitle}${roleLevel ? `, ${roleLevel} level` : ""}${roleStack.length ? `, tech stack: ${roleStack.join(", ")}` : ""}${geography ? `, location: ${geography}` : ""}

INTAKE CALL CONTEXT:
${roleDescription ? `- Role: ${roleDescription}` : ""}
${isBackfill ? `- Backfill. Previous person left: ${backfillReason || "reason unknown"}` : "- New headcount"}
${teamSize ? `- Team size: ${teamSize} people` : ""}
${reportingTo ? `- Reports to: ${reportingTo}` : ""}
${mustHaves.length ? `- Must-haves: ${mustHaves.join(", ")}` : ""}
${niceToHaves.length ? `- Nice-to-haves: ${niceToHaves.join(", ")}` : ""}
${systemDesign ? `- Technical focus: ${systemDesign}` : ""}
${personality ? `- Candidate profile: ${personality}` : ""}

${targetCompanies.length ? `TARGET COMPANIES (from recruiter — INCLUDE these and use them to calibrate):\n${targetCompanies.map(c => `- ${c}`).join("\n")}` : ""}

${avoidCompanies.length ? `COMPANIES TO AVOID (do NOT include):\n${avoidCompanies.map(c => `- ${c}`).join("\n")}` : ""}

Suggest 15-25 companies reflecting the specific technical domain and seniority from the intake.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `You are a technical recruiting market intelligence engine. Given a role brief, suggest 15-25 companies where the recruiter should look for candidates.

Organize into three tiers:
- Tier A (5-8): Direct competitors or same space. Highest signal.
- Tier B (5-8): Adjacent companies, transferable skills.
- Tier C (5-8): Larger/prestigious companies, stretch targets.

For each: company_name, company_domain, tier, reasoning.

Respond ONLY in JSON:
{
  "companies": [
    {"company_name": "Example", "company_domain": "example.com", "tier": "A", "reasoning": "reason"}
  ]
}`,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let companies: Array<{ company_name: string; company_domain: string; tier: string; reasoning: string }> = [];

    try {
      companies = JSON.parse(text).companies || [];
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) companies = JSON.parse(match[1]).companies || [];
    }

    if (companies.length === 0) {
      await prisma.marketMap.update({ where: { id: map.id }, data: { status: "stale" } });
      return Response.json({ error: "No companies generated", mapId: map.id }, { status: 500 });
    }

    // Create company rows
    const created = await Promise.all(
      companies.map((co) =>
        prisma.mapCompany.create({
          data: {
            mapId: map.id,
            companyName: co.company_name,
            companyDomain: co.company_domain,
            tier: co.tier.toUpperCase(),
            tierReasoning: co.reasoning,
            enrichmentStatus: "pending",
          },
        })
      )
    );

    // Update map status
    await prisma.marketMap.update({ where: { id: map.id }, data: { status: "ready" } });

    // Link intake to map
    await prisma.intakeSession.update({
      where: { id },
      data: { mapId: map.id, status: "map_generated" },
    });

    // Auto-create SellingPointKit from intake selling points
    const sellingPts = sp.points as string[] | undefined;
    if (sellingPts?.length) {
      try {
        await prisma.sellingPointKit.create({
          data: {
            userId,
            name: `${roleTitle} — Intake`,
            roleTitle,
            points: sellingPts,
            roleContext: {
              source: "intake",
              intakeId: id,
              teamCulture: sp.teamCulture || null,
              growthPath: sp.growthPath || null,
              techAppeal: sp.techAppeal || null,
            },
          },
        });
      } catch {
        // SellingPointKit creation is non-fatal
      }
    }

    const tiers = { A: 0, B: 0, C: 0 };
    for (const co of companies) {
      const t = co.tier.toUpperCase() as "A" | "B" | "C";
      if (tiers[t] !== undefined) tiers[t]++;
    }

    return Response.json({
      mapId: map.id,
      companies: created.map((c) => ({ id: c.id, name: c.companyName, domain: c.companyDomain, tier: c.tier })),
      totalCompanies: created.length,
      tiers,
    });
  } catch (error) {
    console.error("[intake/generate-map] Failed:", error);
    return Response.json({ error: "Map generation failed" }, { status: 500 });
  }
}
