import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { logAiCall } from "@/lib/ai/logger";
import { safeErrorMessage } from "@/lib/api-error";
import crypto from "crypto";

export const maxDuration = 60;

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    role_title,
    role_level,
    role_stack,
    geography,
    role_description,
    comp_range_min,
    comp_range_max,
  } = body;

  if (!role_title) {
    return Response.json({ error: "role_title is required" }, { status: 400 });
  }

  // Declared outside try so we can reference in catch for failure cleanup
  let map: { id: string } | null = null;
  try {
    // 1. Create the market map record
    map = await prisma.marketMap.create({
      data: {
        userId: userId,
        name: `${role_title} Market Map`,
        roleTitle: role_title,
        roleLevel: role_level || null,
        roleStack: role_stack || [],
        roleDescription: role_description || null,
        geography: geography || [],
        compRangeMin: comp_range_min || null,
        compRangeMax: comp_range_max || null,
        status: "generating",
      },
    });
    console.log("[market-map] Map created:", map.id);

    // 2. Ask Claude to suggest companies
    const anthropic = new Anthropic();

    const systemPrompt = `You are a technical recruiting market intelligence engine. Given a role brief, suggest 15-25 companies where the recruiter should look for candidates.

Organize companies into three tiers:
- Tier A (5-8 companies): Direct competitors or companies in the exact same space. Highest signal talent — people doing this exact job at similar companies.
- Tier B (5-8 companies): Adjacent companies where the skills transfer directly. Different product, same technical challenges.
- Tier C (5-8 companies): Larger or prestigious companies where talent is strong but harder to recruit from. "Stretch" targets.

For each company, provide:
- company_name
- company_domain (the actual website domain, e.g. "fluidstack.io" not "FluidStack")
- tier (A, B, or C)
- reasoning (1 sentence on why this company is relevant for this role)

Respond ONLY in JSON format:
{
  "companies": [
    {"company_name": "CoreWeave", "company_domain": "coreweave.com", "tier": "A", "reasoning": "Direct GPU cloud competitor, similar infrastructure challenges"}
  ]
}`;

    const userMessage = `Find companies for this role: ${role_title}${role_level ? `, ${role_level} level` : ""}${role_stack?.length ? `, tech stack: ${role_stack.join(", ")}` : ""}${geography?.length ? `, location preference: ${geography.join(", ")}` : ""}${role_description ? `. Additional context: ${role_description}` : ""}`;

    const aiStart = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    // Parse Claude's response
    const text = response.content[0].type === "text" ? response.content[0].text : "";
    console.log("[market-map] Claude response received, parsing...");

    let companies: Array<{
      company_name: string;
      company_domain: string;
      tier: string;
      reasoning: string;
    }> = [];

    let parseOk = false;
    try {
      const parsed = JSON.parse(text);
      companies = parsed.companies || [];
      parseOk = Array.isArray(companies);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1].trim());
          companies = parsed.companies || [];
          parseOk = Array.isArray(companies);
        } catch {
          /* invalid fenced JSON */
        }
      }
    }

    logAiCall(
      { userId: userId, feature: "map_generate", metadata: { role_title, role_level, role_stack, geography } },
      {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        latencyMs: Date.now() - aiStart,
        success: parseOk && companies.length > 0,
      }
    ).catch(() => {});

    if (companies.length === 0) {
      await prisma.marketMap.update({
        where: { id: map.id },
        data: { status: "stale" },
      });
      return Response.json(
        { error: "Claude did not return company suggestions", mapId: map.id },
        { status: 500 }
      );
    }

    const tierOk = (t: unknown) => {
      const u = String(t ?? "").toUpperCase();
      return u === "A" || u === "B" || u === "C" ? u : null;
    };

    const insertRows = companies
      .map((co) => {
        const name = String(co.company_name ?? "").trim().slice(0, 500);
        const domain = String(co.company_domain ?? "")
          .trim()
          .replace(/^https?:\/\//i, "")
          .split("/")[0]
          .toLowerCase()
          .slice(0, 253);
        const tier = tierOk(co.tier) ?? "C";
        const reasoning = String(co.reasoning ?? "").trim().slice(0, 4000);
        if (!name || !domain) return null;
        return {
          id: crypto.randomUUID(),
          mapId: map!.id,
          companyName: name,
          companyDomain: domain,
          tier,
          tierReasoning: reasoning || null,
          enrichmentStatus: "pending" as const,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      mapId: string;
      companyName: string;
      companyDomain: string;
      tier: string;
      tierReasoning: string | null;
      enrichmentStatus: "pending";
    }>;

    if (insertRows.length === 0) {
      await prisma.marketMap.update({
        where: { id: map.id },
        data: { status: "stale" },
      });
      return Response.json(
        { error: "AI returned no companies with valid name and domain", mapId: map.id },
        { status: 500 }
      );
    }

    console.log(`[market-map] Parsed ${insertRows.length} valid companies (of ${companies.length}), inserting...`);

    // 3. Batch-insert map_companies in a single round-trip
    await prisma.mapCompany.createMany({
      data: insertRows,
    });

    console.log("[market-map] Companies inserted, fetching back...");

    // Fetch the created companies back (createMany doesn't return records)
    // Explicit select: avoids failing when the DB is behind schema (missing newer columns).
    // Run `npm run db:push` against your DATABASE_URL to fully align the table.
    const createdCompanies = await prisma.mapCompany.findMany({
      where: { mapId: map!.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        companyName: true,
        companyDomain: true,
        tier: true,
        tierReasoning: true,
        enrichmentStatus: true,
        createdAt: true,
      },
    });

    // 4. Update map status — companies created, ready for enrichment
    await prisma.marketMap.update({
      where: { id: map.id },
      data: { status: "ready" },
    });

    console.log(`[market-map] Generation complete: ${createdCompanies.length} companies for map ${map.id}`);

    // 5. Return the map ID and company list so frontend can render skeleton
    return Response.json({
      mapId: map.id,
      companies: createdCompanies.map((c) => ({
        id: c.id,
        name: c.companyName,
        domain: c.companyDomain,
        tier: c.tier,
        reasoning: c.tierReasoning,
        enrichmentStatus: c.enrichmentStatus,
      })),
      totalCompanies: createdCompanies.length,
      tiers: {
        A: createdCompanies.filter((c) => c.tier === "A").length,
        B: createdCompanies.filter((c) => c.tier === "B").length,
        C: createdCompanies.filter((c) => c.tier === "C").length,
      },
    });
  } catch (error) {
    console.error("[market-map] Generation failed:", error);
    // If we created the map, mark it as failed
    if (map?.id) {
      await prisma.marketMap.update({
        where: { id: map.id },
        data: { status: "failed" },
      }).catch(() => {});
    }
    return Response.json(
      { error: safeErrorMessage(error, "Map generation failed") },
      { status: 500 }
    );
  }
}
