import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeErrorMessage } from "@/lib/api-error";
import {
  enrichOrganization,
  extractInvestors,
  searchPeopleAtCompany,
} from "@/lib/connections/apollo";
import {
  detectFormerEmployeeOverlap,
  detectSharedInvestors,
  detectSharedEducation,
  detectGithubOverlap,
  detectLinkedinConnections,
  type DetectedConnection,
} from "@/lib/connections/algorithms";
import { getCached, setCache } from "@/lib/connections/cache";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { target_company_domain, map_id, map_company_id } = body;

  if (!target_company_domain) {
    return Response.json(
      { error: "target_company_domain is required" },
      { status: 400 }
    );
  }

  // Get user's home base
  const homeBase = await prisma.connectionHomeBase.findFirst({
    where: { userId: session.user.id, setupStatus: "ready" },
    orderBy: { createdAt: "desc" },
  });

  if (!homeBase) {
    return Response.json(
      { error: "Home base not set up. Please set up your company first." },
      { status: 400 }
    );
  }

  const domain = target_company_domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  // Check for cached recent lookup
  const cacheKey = `connection_lookup:${homeBase.id}:${domain}`;
  const cached = await getCached<{ lookupId: string }>(cacheKey);
  if (cached) {
    const existingLookup = await prisma.connectionLookup.findUnique({
      where: { id: cached.lookupId },
      include: {
        connections: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (existingLookup) {
      return Response.json({
        id: existingLookup.id,
        targetCompanyName: existingLookup.targetCompanyName,
        targetCompanyDomain: existingLookup.targetCompanyDomain,
        totalConnectionsFound: existingLookup.totalConnectionsFound,
        connectionBreakdown: existingLookup.connectionBreakdown,
        connections: existingLookup.connections,
      });
    }
  }

  try {
    // Step 1: Enrich target company
    const targetOrg = await enrichOrganization(domain);
    const targetInvestors = targetOrg ? extractInvestors(targetOrg) : [];

    // Step 2: Search for target company people
    const targetPeople = await searchPeopleAtCompany(domain, {
      perPage: 100,
      maxPages: 2,
    });

    // Step 3: Create lookup record
    const lookup = await prisma.connectionLookup.create({
      data: {
        userId: session.user.id,
        homeBaseId: homeBase.id,
        targetCompanyName: targetOrg?.name || domain.split(".")[0],
        targetCompanyDomain: domain,
        targetApolloOrgId: targetOrg?.id || null,
        targetInvestors,
        mapId: map_id || null,
        mapCompanyId: map_company_id || null,
      },
    });

    // Step 4: Run all detection algorithms in parallel
    const [
      formerEmployees,
      sharedInvestors,
      sharedEducation,
      githubOverlap,
      linkedinConnections,
    ] = await Promise.all([
      detectFormerEmployeeOverlap(homeBase.id, domain, targetPeople),
      Promise.resolve(
        detectSharedInvestors(
          homeBase.investors,
          targetInvestors,
          targetOrg?.funding_events
        )
      ),
      detectSharedEducation(homeBase.id, targetPeople),
      detectGithubOverlap(homeBase.id, targetPeople),
      detectLinkedinConnections(session.user.id, targetOrg?.name || domain, domain),
    ]);

    const allConnections: DetectedConnection[] = [
      ...formerEmployees,
      ...sharedInvestors,
      ...sharedEducation,
      ...githubOverlap,
      ...linkedinConnections,
    ];

    // Step 5: Generate suggested actions with Claude
    const connectionsWithActions = await generateSuggestedActions(
      allConnections,
      homeBase.companyName,
      targetOrg?.name || domain
    );

    // Step 6: Store connections
    const storedConnections = await Promise.all(
      connectionsWithActions.map((conn) =>
        prisma.connection.create({
          data: {
            lookupId: lookup.id,
            connectionType: conn.connectionType,
            strength: conn.strength,
            homePersonId: conn.homePersonId,
            homePersonName: conn.homePersonName,
            homePersonTitle: conn.homePersonTitle,
            targetPersonName: conn.targetPersonName,
            targetPersonTitle: conn.targetPersonTitle,
            targetPersonApolloId: conn.targetPersonApolloId,
            detail: conn.detail as object,
            suggestedAction: conn.suggestedAction || null,
          },
        })
      )
    );

    // Step 7: Update lookup with totals
    const breakdown: Record<string, number> = {};
    for (const conn of allConnections) {
      breakdown[conn.connectionType] =
        (breakdown[conn.connectionType] || 0) + 1;
    }

    await prisma.connectionLookup.update({
      where: { id: lookup.id },
      data: {
        totalConnectionsFound: allConnections.length,
        connectionBreakdown: breakdown,
      },
    });

    // Cache the lookup ID for future quick retrieval
    await setCache(cacheKey, "connection_lookup", { lookupId: lookup.id });

    return Response.json({
      id: lookup.id,
      targetCompanyName: targetOrg?.name || domain.split(".")[0],
      targetCompanyDomain: domain,
      totalConnectionsFound: allConnections.length,
      connectionBreakdown: breakdown,
      connections: storedConnections,
    });
  } catch (error) {
    console.error("[connections] Lookup failed:", error);
    return Response.json(
      { error: safeErrorMessage(error, "Lookup failed") },
      { status: 500 }
    );
  }
}

// ─── Claude Suggested Action Generation ───

async function generateSuggestedActions(
  connections: DetectedConnection[],
  homeCompany: string,
  targetCompany: string
): Promise<(DetectedConnection & { suggestedAction?: string })[]> {
  if (connections.length === 0) return connections;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return connections;

  // Build the prompt
  const connectionDescriptions = connections.map((c, i) => {
    const parts = [`- Index: ${i}`, `  Type: ${c.connectionType}`];
    if (c.homePersonName)
      parts.push(
        `  Your colleague: ${c.homePersonName}, ${c.homePersonTitle || "team member"}`
      );
    if (c.targetPersonName)
      parts.push(
        `  Target person: ${c.targetPersonName}, ${c.targetPersonTitle || "employee"}`
      );
    parts.push(`  Detail: ${JSON.stringify(c.detail)}`);
    return parts.join("\n");
  });

  const prompt = `You are a recruiting relationship strategist. For each connection between ${homeCompany} and ${targetCompany}, suggest a specific action the recruiter should take to leverage this connection for a warm introduction.

Be specific and actionable. Reference the people by name and the connection context.

Connections:
${connectionDescriptions.join("\n\n")}

For each connection, provide a suggested_action (one sentence, specific and actionable).

Examples of good actions:
- "Ask Sarah Chen to intro you to Marcus Webb — they overlapped at Cloudflare for 2 years on the platform team"
- "Reach out through your Khosla partner — both companies are in the portfolio, ask for a warm intro to their head of engineering"
- "Mention your shared work on the Kubernetes scheduler repo — Jake and Priya both contributed to the autoscaler module"

Respond ONLY in JSON:
{
  "actions": [
    { "connection_index": 0, "suggested_action": "..." }
  ]
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
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[connections] Claude API failed:", res.status);
      return connections;
    }

    const data = await res.json();
    const content = data.content?.[0]?.text || "";

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return connections;

    const parsed = JSON.parse(jsonMatch[0]);
    const actions = parsed.actions || [];

    // Merge actions back into connections
    return connections.map((conn, i) => {
      const action = actions.find(
        (a: { connection_index: number; suggested_action: string }) =>
          a.connection_index === i
      );
      return {
        ...conn,
        suggestedAction: action?.suggested_action || null,
      };
    });
  } catch (error) {
    console.error("[connections] Claude action generation failed:", error);
    return connections;
  }
}
