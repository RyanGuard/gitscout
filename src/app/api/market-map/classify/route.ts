import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { map_id, company_id, role_brief, candidates, company_news, job_postings } = body;

  if (!map_id || !company_id || !candidates?.length) {
    return Response.json({ error: "map_id, company_id, candidates required" }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic();

    const systemPrompt = `You are a technical recruiting analyst. For each candidate, evaluate:

1. FIT SCORE (0-100): How well does this person match the role brief based on their title, seniority, and apparent experience? 90+ = strong match, 70-89 = good match, 50-69 = possible match, <50 = weak match.

2. FIT REASONING: One sentence explaining the score.

3. FLIGHT RISK (low/medium/high): Based on these signals:
   - Tenure < 12 months at current company = higher risk
   - Company has recent layoff/reorg news = higher risk
   - Company is backfilling their exact role (from job postings) = higher risk
   - Multiple signals compound: short tenure + layoff news = high risk

4. FLIGHT RISK SIGNALS: Array of signal keys that apply: "short_tenure", "company_layoffs", "company_reorg", "team_backfilling", "rapid_growth_hire"

Respond ONLY in JSON:
{
  "classifications": [
    {
      "id": "candidate_id",
      "fit_score": 87,
      "fit_reasoning": "Strong infrastructure background, Go experience matches stack requirement",
      "flight_risk": "medium",
      "flight_risk_signals": ["short_tenure"]
    }
  ]
}`;

    const candidateList = candidates.map((c: { id: string; name: string; title: string; seniority: string; tenure_months?: number }) =>
      `- ID: ${c.id}, Name: ${c.name}, Title: ${c.title}, Seniority: ${c.seniority}${c.tenure_months ? `, Tenure: ${c.tenure_months} months` : ""}`
    ).join("\n");

    const userMessage = `Role brief: ${JSON.stringify(role_brief)}

Company candidates:
${candidateList}

${company_news ? `Recent company news: ${company_news}` : ""}
${job_postings?.length ? `Open roles at this company: ${job_postings.map((j: { title: string }) => j.title).join(", ")}` : ""}

Classify each candidate.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    let classifications: Array<{
      id: string;
      fit_score: number;
      fit_reasoning: string;
      flight_risk: string;
      flight_risk_signals: string[];
    }> = [];

    try {
      const parsed = JSON.parse(text);
      classifications = parsed.classifications || [];
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        classifications = parsed.classifications || [];
      }
    }

    // Update candidates with classifications
    let updated = 0;
    for (const cl of classifications) {
      try {
        await prisma.mapCandidate.update({
          where: { id: cl.id },
          data: {
            fitScore: cl.fit_score,
            fitReasoning: cl.fit_reasoning,
            flightRisk: cl.flight_risk,
            flightRiskSignals: cl.flight_risk_signals || [],
          },
        });
        updated++;
      } catch {
        // Candidate ID might not match — skip
      }
    }

    return Response.json({
      classified: updated,
      total: classifications.length,
    });
  } catch (error) {
    console.error("[market-map] Classification failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Classification failed" },
      { status: 500 }
    );
  }
}
