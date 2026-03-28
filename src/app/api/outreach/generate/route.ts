import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const {
    candidateName,
    candidateTitle,
    candidateCompany,
    candidateLocation,
    candidateLinkedinUrl,
    candidateEmail,
    candidateGithubUrl,
    candidateContext,
    sourceType,
    sourceDeveloperId,
    sourceMapId,
    roleTitle,
    roleCompany,
    sellingPoints,
    channel,
    tone,
    sequenceLength,
  } = body;

  if (!candidateName?.trim()) {
    return Response.json({ error: "Candidate name is required" }, { status: 400 });
  }

  const length = Math.min(Math.max(sequenceLength || 3, 1), 5);
  const effectiveChannel = channel || "email";
  const effectiveTone = tone || "professional";

  // Build context for Claude
  const candidateInfo: string[] = [];
  candidateInfo.push(`Name: ${candidateName}`);
  if (candidateTitle) candidateInfo.push(`Title: ${candidateTitle}`);
  if (candidateCompany) candidateInfo.push(`Company: ${candidateCompany}`);
  if (candidateLocation) candidateInfo.push(`Location: ${candidateLocation}`);
  if (candidateLinkedinUrl) candidateInfo.push(`LinkedIn: ${candidateLinkedinUrl}`);
  if (candidateGithubUrl) candidateInfo.push(`GitHub: ${candidateGithubUrl}`);

  // Scout-specific context (scores, repos, connections)
  if (candidateContext) {
    const ctx = candidateContext;
    if (ctx.score) candidateInfo.push(`Scout Score: ${ctx.score}/100`);
    if (ctx.tier) candidateInfo.push(`Tier: ${ctx.tier}`);
    if (ctx.topRepos?.length) {
      candidateInfo.push(`Top repositories: ${ctx.topRepos.map((r: { name: string; stars: number; language: string }) => `${r.name} (${r.stars}★, ${r.language})`).join(", ")}`);
    }
    if (ctx.fitScore) candidateInfo.push(`Fit score: ${ctx.fitScore}/100`);
    if (ctx.fitReasoning) candidateInfo.push(`Fit reasoning: ${ctx.fitReasoning}`);
    if (ctx.flightRisk) candidateInfo.push(`Flight risk: ${ctx.flightRisk}`);
    if (ctx.flightRiskSignals?.length) {
      candidateInfo.push(`Flight risk signals: ${ctx.flightRiskSignals.join(", ")}`);
    }
    if (ctx.languages?.length) {
      candidateInfo.push(`Programming languages: ${ctx.languages.join(", ")}`);
    }
    if (ctx.connections?.length) {
      candidateInfo.push(`Warm connections: ${ctx.connections.map((c: { name: string; type: string }) => `${c.name} (${c.type})`).join(", ")}`);
    }
    if (ctx.bio) candidateInfo.push(`Bio: ${ctx.bio}`);
  }

  const roleInfo: string[] = [];
  if (roleTitle) roleInfo.push(`Role: ${roleTitle}`);
  if (roleCompany) roleInfo.push(`Company: ${roleCompany}`);
  if (sellingPoints?.length) {
    roleInfo.push(`Selling points:\n${sellingPoints.map((p: string) => `- ${p}`).join("\n")}`);
  }

  const channelConstraints: Record<string, string> = {
    email: "Email: subject line 5-8 words, initial body under 100 words, follow-up body under 60 words.",
    linkedin: "LinkedIn: InMail under 150 words, connection request under 300 characters. No subject line for connection requests.",
    text: "Text/SMS: under 160 characters per message. No subject line.",
    multi_channel: "Multi-channel: mix email, LinkedIn, and text. Email: subject 5-8 words, body under 100 words. LinkedIn InMail: under 150 words. Connection request: under 300 chars. Text: under 160 chars.",
  };

  const toneInstructions: Record<string, string> = {
    professional: "Professional and polished. Respectful, clear, and direct.",
    casual: "Casual and conversational. Friendly, approachable, natural.",
    technical_peer: "Engineer-to-engineer. Reference code, projects, and technical depth. Speak as a peer, not a recruiter.",
    executive: "Executive tone. Strategic, concise, focused on business impact and leadership.",
    warm_intro: "Warm introduction style. Lead with the mutual connection. Conversational and personal.",
  };

  const systemPrompt = `You are an expert recruiting outreach writer for Scout, a recruiting intelligence platform. You write personalized outreach sequences that get responses.

ABSOLUTE RULES — never break these:
- NEVER use "I came across your profile"
- NEVER use "hope this finds you well"
- NEVER use "I'm reaching out because"
- NEVER use generic openers. Every message MUST reference something SPECIFIC about this candidate.
- Each message in the sequence MUST use a DIFFERENT personalization angle.
- Follow-up messages MUST add value (share an article idea, industry insight, company news). NEVER just "checking in" or "following up on my last message".

${channelConstraints[effectiveChannel] || channelConstraints.email}

Tone: ${toneInstructions[effectiveTone] || toneInstructions.professional}

${candidateContext?.connections?.length ? "IMPORTANT: This candidate has warm connections. Lead with the mutual connection in the first message." : ""}
${candidateContext?.topRepos?.length ? "IMPORTANT: Reference their actual code/repos — be specific about what they built." : ""}

Return ONLY valid JSON with this exact structure:
{
  "strategy": "Brief 1-2 sentence strategy for this sequence",
  "messages": [
    {
      "step_number": 1,
      "delay_days": 0,
      "channel": "email",
      "subject_line": "Subject here (null for linkedin connection request or text)",
      "body": "Message body here"
    }
  ]
}`;

  const userPrompt = `Write a ${length}-message outreach sequence for this candidate.

CANDIDATE:
${candidateInfo.join("\n")}

${roleInfo.length ? `ROLE:\n${roleInfo.join("\n")}` : ""}

Channel: ${effectiveChannel}
Tone: ${effectiveTone}
Sequence length: ${length} messages

Remember: each message needs a DIFFERENT personalization angle. ${effectiveChannel === "multi_channel" ? "Vary the channels across the sequence." : ""}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    const generated = JSON.parse(jsonMatch[0]);

    // Save to database
    const sequence = await prisma.outreachSequence.create({
      data: {
        userId: session.user.id,
        candidateName: candidateName.trim(),
        candidateTitle: candidateTitle?.trim() || null,
        candidateCompany: candidateCompany?.trim() || null,
        candidateLocation: candidateLocation?.trim() || null,
        candidateLinkedinUrl: candidateLinkedinUrl?.trim() || null,
        candidateEmail: candidateEmail?.trim() || null,
        candidateGithubUrl: candidateGithubUrl?.trim() || null,
        candidateContext: candidateContext || null,
        sourceType: sourceType || "manual",
        sourceDeveloperId: sourceDeveloperId || null,
        sourceMapId: sourceMapId || null,
        roleTitle: roleTitle?.trim() || null,
        roleCompany: roleCompany?.trim() || null,
        sellingPoints: sellingPoints || [],
        channel: effectiveChannel,
        tone: effectiveTone,
        sequenceLength: length,
        status: "draft",
        messages: {
          create: generated.messages.map((msg: { step_number: number; delay_days: number; channel: string; subject_line: string | null; body: string }) => ({
            stepNumber: msg.step_number,
            delayDays: msg.delay_days || 0,
            channel: msg.channel || effectiveChannel,
            subjectLine: msg.subject_line || null,
            body: msg.body,
          })),
        },
      },
      include: { messages: { orderBy: { stepNumber: "asc" } } },
    });

    return Response.json({
      id: sequence.id,
      strategy: generated.strategy,
      messages: sequence.messages.map((m) => ({
        id: m.id,
        stepNumber: m.stepNumber,
        delayDays: m.delayDays,
        channel: m.channel,
        subjectLine: m.subjectLine,
        body: m.body,
      })),
    });
  } catch (err) {
    console.error("Outreach generation error:", err);
    return Response.json({ error: "Failed to generate outreach" }, { status: 500 });
  }
}
