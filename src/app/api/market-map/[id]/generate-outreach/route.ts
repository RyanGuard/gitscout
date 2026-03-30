import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a technical recruiter writing personalized outreach messages to engineering candidates. Your messages should feel human, specific, and respectful of the candidate's time.

RULES:
- Never mention flight risk, fit scores, or Scout scores in the message. Those are internal signals.
- If flight risk is high, make the outreach slightly more urgent but don't reference why.
- If the candidate has a Scout score, you can reference their open source work naturally: "I noticed your contributions to [relevant area]" — but only if it feels organic.
- Each message must be different. Do not use the same opening formula twice.
- Keep total message length under 150 words. Shorter is better.
- Never start with "I came across your profile" or any generic opener.
- Write a specific, personalized opening that references something real about the candidate or their company.

For each candidate, write:
1. SUBJECT LINE: Short, specific, no clickbait. Reference something real about the candidate or their company.
2. FIRST LINE: 1-2 sentences personalized to THIS specific person. Reference their current company, role, or background. Never generic.
3. BODY: 3-4 sentences about the opportunity. Lead with what's compelling for THEM, not what the company needs. End with a soft ask (15-min chat, not "apply now").

Respond ONLY in JSON:
{
  "messages": [
    {
      "candidate_id": "...",
      "subject_line": "...",
      "first_line": "...",
      "body": "..."
    }
  ]
}`;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;
  const body = await request.json().catch(() => ({}));

  const candidateIds: string[] = body.candidate_ids || [];
  const tone: string = body.tone || "professional";
  const sellingPoints: string[] = body.selling_points || [];
  const customInstructions: string = body.custom_instructions || "";

  if (candidateIds.length === 0) {
    return Response.json(
      { error: "candidate_ids required" },
      { status: 400 }
    );
  }

  if (candidateIds.length > 25) {
    return Response.json(
      { error: "Maximum 25 candidates per request" },
      { status: 400 }
    );
  }

  // Verify map ownership
  const map = await prisma.marketMap.findFirst({
    where: { id: mapId, userId: session.user.id },
    select: {
      id: true,
      roleTitle: true,
      roleLevel: true,
      roleStack: true,
      geography: true,
    },
  });

  if (!map) {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  // Fetch candidates with company data
  const candidates = await prisma.mapCandidate.findMany({
    where: {
      id: { in: candidateIds },
      mapId,
    },
    include: {
      company: {
        select: {
          companyName: true,
          companyDomain: true,
          headcount: true,
          fundingStage: true,
        },
      },
    },
  });

  if (candidates.length === 0) {
    return Response.json(
      { error: "No candidates found" },
      { status: 404 }
    );
  }

  // Build candidate context for Claude
  const candidateContext = candidates
    .map(
      (c) => `- Candidate ID: ${c.id}
  Name: ${c.name}
  Current title: ${c.title || "Unknown"}
  Current company: ${c.company.companyName} (${c.company.companyDomain})
  Seniority: ${c.seniority || "Unknown"}
  Location: ${[c.city, c.state].filter(Boolean).join(", ") || "Unknown"}
  Fit score: ${c.fitScore || "N/A"}/100
  Fit reasoning: ${c.fitReasoning || "N/A"}
  Flight risk: ${c.flightRisk || "unknown"}
  Flight risk signals: ${c.flightRiskSignals.length > 0 ? c.flightRiskSignals.join(", ") : "none"}
  ${c.gitscoutScore ? `Scout score: ${c.gitscoutScore} (based on open source contributions)` : ""}`
    )
    .join("\n\n");

  const toneDescription =
    tone === "casual"
      ? "Friendly and conversational, like a peer reaching out"
      : tone === "technical_peer"
        ? "Focuses on the technical challenge, speaks engineer-to-engineer"
        : "Polished but warm, like a senior recruiter at a top firm";

  const userMessage = `ROLE BRIEF:
Title: ${map.roleTitle}
Level: ${map.roleLevel || "Not specified"}
Stack: ${map.roleStack.join(", ") || "Not specified"}
Geography: ${map.geography.join(", ") || "Not specified"}

${
  sellingPoints.length > 0
    ? `SELLING POINTS:\n${sellingPoints.map((p) => `- ${p}`).join("\n")}`
    : ""
}

TONE: ${tone} — ${toneDescription}

${customInstructions ? `ADDITIONAL INSTRUCTIONS:\n${customInstructions}\n` : ""}

CANDIDATES:
${candidateContext}`;

  // Batch into groups of 5
  const batches: typeof candidates[] = [];
  for (let i = 0; i < candidates.length; i += 5) {
    batches.push(candidates.slice(i, i + 5));
  }

  interface GeneratedMessage {
    candidate_id: string;
    subject_line: string;
    first_line: string;
    body: string;
  }

  const allMessages: GeneratedMessage[] = [];
  const errors: string[] = [];

  // Process batches (up to 4 in parallel)
  const batchPromises = batches.map(async (batch, batchIndex) => {
    const batchContext = batch
      .map(
        (c) => `- Candidate ID: ${c.id}
  Name: ${c.name}
  Current title: ${c.title || "Unknown"}
  Current company: ${c.company.companyName} (${c.company.companyDomain})
  Seniority: ${c.seniority || "Unknown"}
  Location: ${[c.city, c.state].filter(Boolean).join(", ") || "Unknown"}
  Fit score: ${c.fitScore || "N/A"}/100
  Fit reasoning: ${c.fitReasoning || "N/A"}
  Flight risk: ${c.flightRisk || "unknown"}
  Flight risk signals: ${c.flightRiskSignals.length > 0 ? c.flightRiskSignals.join(", ") : "none"}
  ${c.gitscoutScore ? `Scout score: ${c.gitscoutScore} (based on open source contributions)` : ""}`
      )
      .join("\n\n");

    const batchUserMessage = `ROLE BRIEF:
Title: ${map.roleTitle}
Level: ${map.roleLevel || "Not specified"}
Stack: ${map.roleStack.join(", ") || "Not specified"}

${sellingPoints.length > 0 ? `SELLING POINTS:\n${sellingPoints.map((p) => `- ${p}`).join("\n")}` : ""}

TONE: ${tone} — ${toneDescription}

${customInstructions ? `ADDITIONAL INSTRUCTIONS:\n${customInstructions}\n` : ""}

CANDIDATES:
${batchContext}`;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: batchUserMessage }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      let parsed: { messages: GeneratedMessage[] };
      try {
        parsed = JSON.parse(text);
      } catch {
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error("Failed to parse Claude response");
        }
      }

      return parsed.messages;
    } catch (err) {
      console.error(`Outreach batch ${batchIndex} failed:`, err);
      errors.push(`Batch ${batchIndex} failed`);
      return [];
    }
  });

  const batchResults = await Promise.allSettled(batchPromises);

  for (const result of batchResults) {
    if (result.status === "fulfilled") {
      allMessages.push(...result.value);
    }
  }

  // Save to database
  const savedMessages = [];
  for (const msg of allMessages) {
    try {
      const saved = await prisma.outreachMessage.create({
        data: {
          mapId,
          candidateId: msg.candidate_id,
          userId: session.user.id,
          subjectLine: msg.subject_line,
          firstLine: msg.first_line,
          body: msg.body,
          variant: "direct",
          status: "draft",
        },
      });

      // Update candidate outreach status
      await prisma.mapCandidate.update({
        where: { id: msg.candidate_id },
        data: { outreachStatus: "draft" },
      });

      savedMessages.push({
        id: saved.id,
        candidateId: msg.candidate_id,
        subjectLine: msg.subject_line,
        firstLine: msg.first_line,
        body: msg.body,
      });
    } catch (err) {
      console.error("Failed to save outreach message:", err);
    }
  }

  return Response.json({
    generated: savedMessages.length,
    messages: savedMessages,
    errors: errors.length > 0 ? errors : undefined,
  });
}
