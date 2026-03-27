import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const APOLLO_API = "https://api.apollo.io/api/v1";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { candidate_ids, reveal_email = true, reveal_phone = false } = body;

  if (!candidate_ids?.length) {
    return Response.json({ error: "candidate_ids required" }, { status: 400 });
  }

  if (candidate_ids.length > 10) {
    return Response.json({ error: "Max 10 candidates per request" }, { status: 400 });
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Fetch candidates to get Apollo person IDs
    const candidates = await prisma.mapCandidate.findMany({
      where: { id: { in: candidate_ids } },
    });

    // Separate: already enriched vs needs enrichment
    const alreadyEnriched = candidates.filter((c) => c.email);
    const needsEnrichment = candidates.filter((c) => !c.email && c.apolloPersonId);

    // Check cache first
    const results: Array<{ id: string; email: string | null; phone: string | null }> = [];

    for (const c of alreadyEnriched) {
      results.push({ id: c.id, email: c.email, phone: c.phone });
    }

    if (needsEnrichment.length > 0) {
      // Check enrichment cache
      const uncached: typeof needsEnrichment = [];

      for (const c of needsEnrichment) {
        const cacheKey = `person_enrichment:${c.apolloPersonId}`;
        const cached = await prisma.enrichmentCache.findUnique({
          where: { cacheKey },
        });

        if (cached && cached.expiresAt > new Date()) {
          const data = cached.data as { email?: string; phone?: string };
          await prisma.mapCandidate.update({
            where: { id: c.id },
            data: {
              email: data.email || null,
              phone: data.phone || null,
              emailEnrichedAt: new Date(),
            },
          });
          results.push({ id: c.id, email: data.email || null, phone: data.phone || null });
        } else {
          uncached.push(c);
        }
      }

      // Call Apollo Bulk People Enrichment for uncached (THIS COSTS CREDITS)
      if (uncached.length > 0) {
        const enrichRes = await fetch(`${APOLLO_API}/people/bulk_match`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            reveal_personal_emails: reveal_email,
            reveal_phone_number: reveal_phone,
            details: uncached.map((c) => ({ id: c.apolloPersonId })),
          }),
        });

        if (enrichRes.ok) {
          const enrichData = await enrichRes.json();
          const matches = enrichData.matches || [];

          for (let i = 0; i < uncached.length; i++) {
            const candidate = uncached[i];
            const match = matches[i];

            const email = match?.email || match?.personal_emails?.[0] || null;
            const phone = match?.phone_numbers?.[0]?.sanitized_number || null;

            // Update candidate
            await prisma.mapCandidate.update({
              where: { id: candidate.id },
              data: {
                email,
                phone,
                emailEnrichedAt: new Date(),
              },
            });

            // Cache the result (30 day TTL)
            const cacheKey = `person_enrichment:${candidate.apolloPersonId}`;
            await prisma.enrichmentCache.upsert({
              where: { cacheKey },
              create: {
                cacheKey,
                cacheType: "person_enrichment",
                data: { email, phone } as object,
                expiresAt: new Date(Date.now() + 30 * 86400000),
              },
              update: {
                data: { email, phone } as object,
                expiresAt: new Date(Date.now() + 30 * 86400000),
              },
            }).catch(() => {});

            results.push({ id: candidate.id, email, phone });
          }
        } else {
          console.error("[reveal] Apollo enrichment failed:", enrichRes.status);
          return Response.json(
            { error: `Apollo enrichment failed (${enrichRes.status})`, partial: results },
            { status: 502 }
          );
        }
      }
    }

    return Response.json({
      revealed: results.length,
      creditsUsed: needsEnrichment.filter((c) => !alreadyEnriched.find((a) => a.id === c.id)).length,
      results,
    });
  } catch (error) {
    console.error("[reveal] Failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Reveal failed" },
      { status: 500 }
    );
  }
}
