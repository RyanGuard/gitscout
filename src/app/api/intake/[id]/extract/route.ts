import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJobDescription } from "@/lib/jd-parser";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await prisma.intakeSession.findUnique({ where: { id } });
  if (!session) return Response.json({ error: "Not found" }, { status: 404 });
  if (session.userId !== userId) return Response.json({ error: "Forbidden" }, { status: 403 });

  // Get notes from session or request body
  const body = await request.json().catch(() => ({}));
  const rawNotes = body.notes || (session.rawNotes as string) || "";

  if (rawNotes.length < 50) {
    return Response.json({ error: "Notes must be at least 50 characters" }, { status: 400 });
  }

  // Run JD parser for tech term detection
  const parsed = parseJobDescription(rawNotes);
  const parserContext = parsed.languages.length || parsed.frameworks.length || parsed.tools.length
    ? `\nTechnical terms detected by parser (verify against notes): Languages: ${parsed.languages.join(", ")}, Frameworks: ${parsed.frameworks.join(", ")}, Tools: ${parsed.tools.join(", ")}`
    : "";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: `You are an expert technical recruiter analyzing intake call notes. Extract ALL relevant information into structured JSON.

Be thorough — capture everything mentioned, even casual comments or implied requirements. If something is mentioned but ambiguous, include it with your best interpretation. Missing data should be null, not fabricated. NEVER invent information that isn't in the notes.

For technical requirements, be specific about exact technologies mentioned. "We use Go" means Go is a language. "Built on Kubernetes" means Kubernetes is a tool. "React frontend" means React is a framework.

Extract into this exact structure:
{
  "roleBasics": { "title": "string", "level": "junior|mid|senior|staff|principal|null", "department": "string|null", "teamSize": "number|null", "reportingTo": "string|null", "isBackfill": "boolean", "backfillReason": "string|null", "responsibilities": "string|null" },
  "candidateProfile": { "mustHaves": ["required skills"], "niceToHaves": ["preferred skills"], "yearsExperience": "number|null", "personality": "string|null" },
  "technicalReqs": { "languages": ["langs"], "frameworks": ["frameworks"], "tools": ["tools"], "systemDesign": "string|null", "infrastructure": "string|null" },
  "compensation": { "min": "number|null (parse 180K as 180000)", "max": "number|null", "equity": "boolean", "bonus": "string|null" },
  "logistics": { "remote": "boolean", "hybrid": "boolean", "onsite": "boolean", "location": "string|null", "visaSponsorship": "boolean", "startDate": "string|null" },
  "interviewProcess": { "stages": ["stages"], "timeline": "string|null", "takeHome": "boolean|null" },
  "sellingPoints": { "points": ["reasons to join"], "teamCulture": "string|null", "growthPath": "string|null", "techAppeal": "string|null" },
  "sourcingStrategy": { "targetCompanies": ["companies to source from"], "avoidCompanies": ["companies to avoid"], "notes": "string|null" },
  "redFlags": { "disqualifiers": ["disqualifiers"], "nonNegotiables": ["absolute requirements"], "pastBadHires": "string|null" },
  "roleBrief": "2-3 sentence executive summary"
}

Respond ONLY in valid JSON.`,
      messages: [{
        role: "user",
        content: `Extract structured intake data from these call notes:\n\n---\n${rawNotes}\n---${parserContext}\n\nExtract every detail mentioned.`,
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    let extracted: Record<string, unknown>;
    try {
      extracted = JSON.parse(text);
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        extracted = JSON.parse(match[1]);
      } else {
        return Response.json({ error: "Failed to parse AI response" }, { status: 500 });
      }
    }

    // Merge JD parser tech into extraction (add any the parser found that Claude missed)
    const techReqs = (extracted.technicalReqs || {}) as Record<string, unknown>;
    const extractedLangs = (techReqs.languages as string[]) || [];
    const extractedFrameworks = (techReqs.frameworks as string[]) || [];
    const extractedTools = (techReqs.tools as string[]) || [];

    for (const lang of parsed.languages) {
      if (!extractedLangs.some(l => l.toLowerCase() === lang.toLowerCase())) extractedLangs.push(lang);
    }
    for (const fw of parsed.frameworks) {
      if (!extractedFrameworks.some(f => f.toLowerCase() === fw.toLowerCase())) extractedFrameworks.push(fw);
    }
    for (const tool of parsed.tools) {
      if (!extractedTools.some(t => t.toLowerCase() === tool.toLowerCase())) extractedTools.push(tool);
    }

    techReqs.languages = extractedLangs;
    techReqs.frameworks = extractedFrameworks;
    techReqs.tools = extractedTools;
    extracted.technicalReqs = techReqs;

    // Update the intake session
    await prisma.intakeSession.update({
      where: { id },
      data: {
        roleBasics: extracted.roleBasics as object || undefined,
        candidateProfile: extracted.candidateProfile as object || undefined,
        technicalReqs: extracted.technicalReqs as object || undefined,
        compensation: extracted.compensation as object || undefined,
        logistics: extracted.logistics as object || undefined,
        interviewProcess: extracted.interviewProcess as object || undefined,
        sellingPoints: extracted.sellingPoints as object || undefined,
        sourcingStrategy: extracted.sourcingStrategy as object || undefined,
        redFlags: extracted.redFlags as object || undefined,
        roleBrief: (extracted.roleBrief as string) || null,
        rawNotes,
        status: "complete",
      },
    });

    return Response.json(extracted);
  } catch (error) {
    console.error("[intake/extract] Failed:", error);
    return Response.json({ error: "Extraction failed" }, { status: 500 });
  }
}
