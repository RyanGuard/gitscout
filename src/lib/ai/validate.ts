import * as Sentry from "@sentry/nextjs";

export function validateMapGeneration(companies: Array<{ company_name: string; company_domain: string; tier: string; reasoning: string }>): string[] {
  const issues: string[] = [];

  if (companies.length < 10) issues.push(`Only ${companies.length} companies (expected 15-25)`);
  if (companies.length > 30) issues.push(`Too many companies: ${companies.length}`);

  const tiers = { A: 0, B: 0, C: 0 };
  for (const co of companies) {
    const tier = co.tier.toUpperCase();
    if (tier in tiers) tiers[tier as keyof typeof tiers]++;
    else issues.push(`Invalid tier "${co.tier}" for ${co.company_name}`);

    if (!co.company_domain || co.company_domain === "example.com") {
      issues.push(`Invalid domain for ${co.company_name}: "${co.company_domain}"`);
    }
    if (!co.reasoning || co.reasoning.length < 10) {
      issues.push(`Weak reasoning for ${co.company_name}`);
    }
  }

  if (tiers.A === 0) issues.push("No Tier A companies");
  if (tiers.B === 0) issues.push("No Tier B companies");
  if (tiers.C === 0) issues.push("No Tier C companies");

  if (issues.length > 0) {
    Sentry.captureMessage("AI output validation issues: map_generate", {
      level: "warning",
      extra: { issues, companyCount: companies.length, tiers },
    });
  }

  return issues;
}

export function validateClassification(classifications: Array<{ id: string; fit_score: number; fit_reasoning: string; flight_risk: string; flight_risk_signals: string[] }>): string[] {
  const issues: string[] = [];

  for (const c of classifications) {
    if (c.fit_score < 0 || c.fit_score > 100) {
      issues.push(`Invalid fit score ${c.fit_score} for ${c.id}`);
    }
    if (!["low", "medium", "high"].includes(c.flight_risk)) {
      issues.push(`Invalid flight risk "${c.flight_risk}" for ${c.id}`);
    }
    if (!c.fit_reasoning || c.fit_reasoning.length < 10) {
      issues.push(`Weak fit reasoning for ${c.id}`);
    }
  }

  if (issues.length > 0) {
    Sentry.captureMessage("AI output validation issues: classify", {
      level: "warning",
      extra: { issues, candidateCount: classifications.length },
    });
  }

  return issues;
}

export function validateOutreachMessages(messages: Array<{ step_number: number; channel: string; body: string; subject_line?: string | null }>, channel: string): string[] {
  const issues: string[] = [];
  const bannedPhrases = [
    "i came across your profile",
    "hope this finds you well",
    "i'm reaching out because",
    "hope this email finds you",
    "i wanted to reach out",
  ];

  for (const msg of messages) {
    const bodyLower = msg.body.toLowerCase();

    for (const phrase of bannedPhrases) {
      if (bodyLower.includes(phrase)) {
        issues.push(`Banned phrase "${phrase}" in step ${msg.step_number}`);
      }
    }

    if (channel === "linkedin" && msg.body.length > 300) {
      issues.push(`LinkedIn message too long (${msg.body.length} chars) in step ${msg.step_number}`);
    }
    if (channel === "text" && msg.body.length > 160) {
      issues.push(`Text message too long (${msg.body.length} chars) in step ${msg.step_number}`);
    }
    if (channel === "email" && msg.body.split(/\s+/).length > 150) {
      issues.push(`Email too long (${msg.body.split(/\s+/).length} words) in step ${msg.step_number}`);
    }
  }

  if (issues.length > 0) {
    Sentry.captureMessage("AI output validation issues: outreach", {
      level: "warning",
      extra: { issues, channel, messageCount: messages.length },
    });
  }

  return issues;
}
