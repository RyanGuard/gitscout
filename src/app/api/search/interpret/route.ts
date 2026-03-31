import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface InterpretedSearch {
  keywords: string[];
  languages: string[];
  location: string | null;
  seniority: string | null;
  companyContext: string | null;
  specialSignals: string[];
  suggestedQuery: string;
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { query } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json(
      { error: "query is required and must be a non-empty string" },
      { status: 400 }
    );
  }

  try {
    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: `You are a search query interpreter for a developer recruiting platform. Given a natural language recruiting query, extract structured search parameters.

Extract the following fields:
- keywords: technology and skill terms (e.g. ["Kubernetes", "distributed systems", "microservices"])
- languages: programming languages detected (e.g. ["Go", "Python"])
- location: city, region, or country if mentioned (e.g. "Austin, TX"), or null if not specified
- seniority: one of "junior", "mid", "senior", "staff", "principal", or null if not specified
- companyContext: company stage or type constraints if mentioned (e.g. "Series B startup", "FAANG"), or null if not specified
- specialSignals: specific distinguishing criteria like open source contributions, speaking experience, specific project work (e.g. ["contributed to Kubernetes", "conference speaker"])
- suggestedQuery: an optimized search query string for the GitHub Search Users API. Combine relevant terms using GitHub search qualifiers where possible (language:, location:, followers:>, repos:>, etc.). Free-text terms should be space-separated at the start.

Respond ONLY in JSON format:
{
  "keywords": [],
  "languages": [],
  "location": null,
  "seniority": null,
  "companyContext": null,
  "specialSignals": [],
  "suggestedQuery": ""
}`,
      messages: [{ role: "user", content: query.trim() }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    let interpreted: InterpretedSearch;

    try {
      interpreted = JSON.parse(text);
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        interpreted = JSON.parse(jsonMatch[1]);
      } else {
        return NextResponse.json(
          { error: "Failed to parse Claude response" },
          { status: 500 }
        );
      }
    }

    // Normalize and validate the parsed output
    interpreted = {
      keywords: Array.isArray(interpreted.keywords) ? interpreted.keywords : [],
      languages: Array.isArray(interpreted.languages)
        ? interpreted.languages
        : [],
      location: interpreted.location || null,
      seniority: interpreted.seniority || null,
      companyContext: interpreted.companyContext || null,
      specialSignals: Array.isArray(interpreted.specialSignals)
        ? interpreted.specialSignals
        : [],
      suggestedQuery:
        typeof interpreted.suggestedQuery === "string"
          ? interpreted.suggestedQuery
          : "",
    };

    return NextResponse.json({
      interpreted,
      original: query.trim(),
    });
  } catch (error) {
    console.error("[search/interpret] Failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Search interpretation failed",
      },
      { status: 500 }
    );
  }
}
