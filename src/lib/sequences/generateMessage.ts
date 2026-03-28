/**
 * AI message generation for sequences using Claude Sonnet 4.
 * Builds on the existing pattern from /api/market-map/[id]/generate-outreach.
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface CandidateContext {
  name: string;
  title?: string;
  company?: string;
  city?: string;
  linkedinUrl?: string;
  fitScore?: number;
  fitReasoning?: string;
  flightRisk?: string;
  flightRiskSignals?: string[];
  scoutScore?: number;
  languages?: string[];
  topRepos?: Array<{ name: string; description?: string; stars?: number }>;
  connections?: Array<{ type: string; strength: string; detail: string }>;
  [key: string]: unknown;
}

interface GenerateParams {
  candidateContext: CandidateContext;
  channel: string; // email | linkedin | inmail
  stepOrder: number;
  purpose?: string; // initial_outreach | follow_up | value_add | breakup
  tone: string; // professional | casual | technical_peer
  sellingPoints: string[];
  customInstructions?: string;
  roleTitle?: string;
  roleDescription?: string;
  companyName?: string;
  previousMessages?: Array<{ channel: string; body: string }>;
}

interface GeneratedMessage {
  subjectLine?: string; // Only for email/inmail
  body: string;
}

function buildSystemPrompt(params: GenerateParams): string {
  const { channel, stepOrder, purpose, tone } = params;

  const toneDesc =
    tone === "casual"
      ? "Casual and friendly, like a peer reaching out."
      : tone === "technical_peer"
        ? "Technical and specific, engineer-to-engineer."
        : "Professional but warm, recruiter who understands engineering.";

  const channelRules =
    channel === "linkedin"
      ? "This is a LinkedIn connection request or message. Keep it under 300 characters. No subject line needed. Very conversational."
      : channel === "inmail"
        ? "This is a LinkedIn InMail. Include a short subject line. Keep the body under 100 words. Professional but concise."
        : "This is an email. Include a subject line. Keep the body under 150 words.";

  const purposeDesc =
    purpose === "follow_up"
      ? "This is a follow-up message. Reference that you reached out before. Add new value or a different angle. Don't repeat the first message."
      : purpose === "value_add"
        ? "This is a value-add touch. Share something useful — an article, insight, or connection — not another pitch."
        : purpose === "breakup"
          ? "This is a final touch. Keep it very short. Acknowledge they're busy. Leave the door open without pressure."
          : "This is the initial outreach. Make a strong first impression with something specific to this person.";

  return `You are a recruiting outreach writer for Scout, a recruiting intelligence platform.

TONE: ${toneDesc}

CHANNEL: ${channelRules}

PURPOSE: ${purposeDesc}
${stepOrder > 0 ? `This is step ${stepOrder + 1} of a multi-touch sequence.` : ""}

RULES:
- Never mention "flight risk", "fit score", "Scout Score", or any internal scoring in the message
- Reference specific projects, technologies, or contributions when available
- Each message must feel hand-written, not templated
- Subject lines should be short (under 50 chars), specific, never generic
- End with a soft ask — suggest a quick chat, not "apply now"
- Never use exclamation marks excessively
- No "I came across your profile" or "I was impressed by" — be specific

Respond ONLY in JSON format:
${channel === "linkedin" ? '{"body": "..."}' : '{"subject_line": "...", "body": "..."}'}`;
}

function buildUserPrompt(params: GenerateParams): string {
  const { candidateContext: ctx, sellingPoints, customInstructions, roleTitle, companyName, previousMessages } = params;

  let prompt = "Generate a personalized outreach message for this candidate:\n\n";
  prompt += `Name: ${ctx.name}\n`;
  if (ctx.title) prompt += `Title: ${ctx.title}\n`;
  if (ctx.company) prompt += `Company: ${ctx.company}\n`;
  if (ctx.city) prompt += `Location: ${ctx.city}\n`;

  if (ctx.languages && ctx.languages.length > 0) {
    prompt += `Languages: ${ctx.languages.join(", ")}\n`;
  }

  if (ctx.topRepos && ctx.topRepos.length > 0) {
    prompt += `\nNotable projects:\n`;
    for (const repo of ctx.topRepos.slice(0, 3)) {
      prompt += `- ${repo.name}${repo.description ? `: ${repo.description}` : ""}${repo.stars ? ` (${repo.stars} stars)` : ""}\n`;
    }
  }

  if (ctx.connections && ctx.connections.length > 0) {
    prompt += `\nWarm connections (use subtly, don't name-drop unless appropriate):\n`;
    for (const conn of ctx.connections.slice(0, 3)) {
      prompt += `- ${conn.type}: ${conn.detail} (${conn.strength})\n`;
    }
  }

  // Internal context for AI (not to be included in message)
  if (ctx.fitReasoning) prompt += `\n[INTERNAL - do not include in message] Fit analysis: ${ctx.fitReasoning}\n`;
  if (ctx.flightRisk && ctx.flightRisk !== "low") {
    prompt += `[INTERNAL] Flight risk: ${ctx.flightRisk}${ctx.flightRiskSignals?.length ? ` (${ctx.flightRiskSignals.join(", ")})` : ""}\n`;
  }

  if (roleTitle) prompt += `\nRole: ${roleTitle}\n`;
  if (companyName) prompt += `Company hiring: ${companyName}\n`;

  if (sellingPoints.length > 0) {
    prompt += `\nSelling points:\n${sellingPoints.map((p) => `- ${p}`).join("\n")}\n`;
  }

  if (customInstructions) {
    prompt += `\nAdditional instructions: ${customInstructions}\n`;
  }

  if (previousMessages && previousMessages.length > 0) {
    prompt += `\nPrevious messages in this sequence (do NOT repeat these):\n`;
    for (const msg of previousMessages) {
      prompt += `[${msg.channel}]: ${msg.body.slice(0, 200)}...\n`;
    }
  }

  return prompt;
}

export async function generateSequenceMessage(
  params: GenerateParams
): Promise<GeneratedMessage> {
  const systemPrompt = buildSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as GeneratedMessage;
    }
  } catch {
    // Fallback: use raw text as body
  }

  return { body: text };
}
