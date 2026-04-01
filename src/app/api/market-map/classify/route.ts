import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { logAiCall } from "@/lib/ai/logger";
import { safeErrorMessage } from "@/lib/api-error";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const {
    map_id,
    company_id,
    role_brief,
    candidates,
    company_news,
    company_news_events,
    job_postings,
    company_growth_rate,
  } = body;

  if (!map_id || !company_id || !candidates?.length) {
    return Response.json({ error: "map_id, company_id, candidates required" }, { status: 400 });
  }

  try {
    const anthropic = new Anthropic();

    const systemPrompt = `You are a technical recruiting analyst evaluating candidates for both role fit AND flight risk — how likely they are to be open to a new opportunity.

For each candidate, evaluate:

═══ FIT ASSESSMENT ═══

FIT SCORE (0-100): How well does this person match the role brief based on their title, seniority, and apparent experience?
- 90+ = strong match (exact title/seniority match, relevant domain)
- 70-89 = good match (related title, transferable skills)
- 50-69 = possible match (adjacent role, would need to stretch)
- <50 = weak match (different function or too junior/senior)

FIT REASONING: One sentence explaining the score.

═══ FLIGHT RISK ASSESSMENT ═══

Evaluate these signals:

SIGNAL: SHORT_TENURE
- tenure < 6 months: strong signal (still settling in OR regrets the move)
- tenure 6-12 months: moderate signal
- tenure 12-24 months: weak signal
- tenure > 24 months: not a signal

SIGNAL: COMPANY_LAYOFFS
- Company has had layoffs or RIF in the last 6 months: strong signal
- Company had reorg/restructuring: moderate signal
- No negative news: not a signal

SIGNAL: TEAM_BACKFILLING
- Company has an open job posting with a similar title to this candidate: moderate signal (their team is experiencing turnover)
- No matching postings: not a signal

SIGNAL: RAPID_GROWTH_HIRE
- Company grew > 40% YoY AND candidate tenure < 18 months: weak signal (joined during hypergrowth, culture may have shifted)

SIGNAL: LEADERSHIP_CHANGE
- Company had CTO/VP Eng departure in last 6 months: moderate signal for engineering candidates

Compound rules:
- 2+ moderate signals = high flight risk
- 1 strong signal = high flight risk
- 1 moderate signal alone = medium flight risk
- Only weak signals = low flight risk
- No signals = low flight risk

FLIGHT RISK: "low", "medium", or "high"
FLIGHT RISK SIGNALS: array of signal keys that apply
FLIGHT RISK REASONING: one sentence explaining the assessment

═══ RESPONSE FORMAT ═══

Respond ONLY in JSON:
{
  "classifications": [
    {
      "id": "candidate_id",
      "fit_score": 87,
      "fit_reasoning": "Strong infrastructure background, Go experience matches stack requirement",
      "flight_risk": "medium",
      "flight_risk_signals": ["short_tenure", "team_backfilling"],
      "flight_risk_reasoning": "Short tenure (8 months) combined with the company actively backfilling similar roles suggests openness to new opportunities"
    }
  ]
}`;

    const candidateList = candidates
      .map(
        (c: {
          id: string;
          name: string;
          title: string;
          seniority: string;
          tenure_months?: number;
          city?: string;
        }) =>
          `- ID: ${c.id}, Name: ${c.name}, Title: ${c.title}, Seniority: ${c.seniority}${c.tenure_months ? `, Tenure: ${c.tenure_months} months` : ""}${c.city ? `, Location: ${c.city}` : ""}`
      )
      .join("\n");

    // Build context about the company
    const newsContext = company_news_events?.length
      ? `\nCompany news events:\n${company_news_events
          .map((e: { event_type: string; severity: string; summary: string }) => `  - ${e.event_type} (${e.severity}): ${e.summary}`)
          .join("\n")}`
      : company_news
        ? `\nRecent company news: ${company_news}`
        : "";

    const jobContext = job_postings?.length
      ? `\nOpen roles at this company: ${job_postings.map((j: { title: string }) => j.title).join(", ")}`
      : "";

    const growthContext = company_growth_rate
      ? `\nCompany YoY growth: ${company_growth_rate}`
      : "";

    const userMessage = `Role brief: ${JSON.stringify(role_brief)}

Company candidates:
${candidateList}
${newsContext}${jobContext}${growthContext}

Evaluate each candidate for both fit and flight risk.`;

    const aiStart = Date.now();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    logAiCall(
      { feature: "classify", metadata: { candidateCount: candidates.length } },
      { inputTokens: response.usage?.input_tokens || 0, outputTokens: response.usage?.output_tokens || 0, latencyMs: Date.now() - aiStart, success: true }
    ).catch(() => {});
    let classifications: Array<{
      id: string;
      fit_score: number;
      fit_reasoning: string;
      flight_risk: string;
      flight_risk_signals: string[];
      flight_risk_reasoning?: string;
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
            flightRiskReasoning: cl.flight_risk_reasoning || null,
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
      highRisk: classifications.filter((c) => c.flight_risk === "high").length,
      mediumRisk: classifications.filter((c) => c.flight_risk === "medium").length,
    });
  } catch (error) {
    console.error("[market-map] Classification failed:", error);
    return Response.json(
      { error: safeErrorMessage(error, "Classification failed") },
      { status: 500 }
    );
  }
}
