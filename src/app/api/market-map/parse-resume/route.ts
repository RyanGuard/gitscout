import { getAuthUserId } from "@/lib/auth";
import { parseJobDescription } from "@/lib/jd-parser";

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || !file.name.endsWith(".pdf")) {
    return Response.json({ error: "PDF file required" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    const text = textResult.text;

    if (!text || text.trim().length < 50) {
      return Response.json({ error: "Could not extract text from PDF" }, { status: 400 });
    }

    const parsed = parseJobDescription(text);

    let roleTitle = "";
    if (parsed.seniority) roleTitle += parsed.seniority.charAt(0).toUpperCase() + parsed.seniority.slice(1) + " ";
    if (parsed.keywords.length > 0) {
      roleTitle += parsed.keywords[0].charAt(0).toUpperCase() + parsed.keywords[0].slice(1);
    } else if (parsed.frameworks.length > 0) {
      roleTitle += parsed.frameworks[0] + " Engineer";
    } else if (parsed.languages.length > 0) {
      roleTitle += parsed.languages[0] + " Developer";
    } else {
      roleTitle += "Software Engineer";
    }

    return Response.json({
      role_title: roleTitle.trim(),
      role_level: parsed.seniority || null,
      role_stack: [...parsed.languages, ...parsed.frameworks, ...parsed.tools].slice(0, 10),
      keywords: parsed.keywords,
      years_experience: parsed.yearsExperience,
      location: parsed.location,
      raw_text_length: text.length,
    });
  } catch (error) {
    console.error("[parse-resume] Failed:", error);
    return Response.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
