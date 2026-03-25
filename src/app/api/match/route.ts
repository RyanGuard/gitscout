import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJobDescription } from "@/lib/jd-parser";
import { computeFitScore } from "@/lib/matcher";
import type { ParsedRequirements, DeveloperProfile } from "@/types";

async function fetchAshbyJobDescription(jobId: string): Promise<string | null> {
  const apiKey = process.env.ASHBY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.ashbyhq.com/jobPosting.list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const postings = data.results || [];
    const posting = postings.find(
      (p: { jobId: string; descriptionPlain?: string }) => p.jobId === jobId
    );

    return posting?.descriptionPlain || null;
  } catch {
    return null;
  }
}

function toDeveloperProfile(dev: {
  id: string;
  githubId: number;
  username: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitterUsername: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  hireable: boolean;
  primaryLanguage: string | null;
  totalCommits: number;
  totalStars: number;
  score: number;
  languages: Array<{
    language: string;
    bytes: number;
    repoCount: number;
    percentage: number;
  }>;
  repositories: Array<{
    id: string;
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    forks: number;
    topics: string[];
    pushedAt: Date | null;
  }>;
}): DeveloperProfile {
  return {
    id: dev.id,
    githubId: dev.githubId,
    username: dev.username,
    name: dev.name,
    email: dev.email,
    avatarUrl: dev.avatarUrl,
    bio: dev.bio,
    company: dev.company,
    location: dev.location,
    blog: dev.blog,
    twitterUsername: dev.twitterUsername,
    publicRepos: dev.publicRepos,
    followers: dev.followers,
    following: dev.following,
    hireable: dev.hireable,
    primaryLanguage: dev.primaryLanguage,
    totalCommits: dev.totalCommits,
    totalStars: dev.totalStars,
    score: dev.score,
    languages: dev.languages.map((l) => ({
      language: l.language,
      bytes: l.bytes,
      repoCount: l.repoCount,
      percentage: l.percentage,
    })),
    repositories: dev.repositories.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.fullName,
      description: r.description,
      language: r.language,
      stars: r.stars,
      forks: r.forks,
      topics: r.topics,
      pushedAt: r.pushedAt ? r.pushedAt.toISOString() : null,
    })),
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let requirements: ParsedRequirements;
    let jdText: string | null = null;

    if (body.jobDescription && typeof body.jobDescription === "string") {
      jdText = body.jobDescription;
    } else if (body.jobId && typeof body.jobId === "string") {
      jdText = await fetchAshbyJobDescription(body.jobId);
      if (!jdText) {
        return NextResponse.json(
          { error: "Could not fetch job description from Ashby" },
          { status: 404 }
        );
      }
    } else if (body.requirements) {
      // Allow passing pre-edited requirements directly
      requirements = body.requirements as ParsedRequirements;
    } else {
      return NextResponse.json(
        { error: "Provide 'jobDescription', 'jobId', or 'requirements'" },
        { status: 400 }
      );
    }

    // Parse JD if we got raw text
    if (!requirements!) {
      requirements = parseJobDescription(jdText!);
    }

    // Build Prisma where clause — pre-filter on languages if any specified
    const whereClause: Record<string, unknown> = {};
    if (requirements.languages.length > 0) {
      whereClause.languages = {
        some: {
          language: {
            in: requirements.languages,
            mode: "insensitive",
          },
        },
      };
    }

    const candidates = await prisma.developer.findMany({
      where: whereClause,
      include: { languages: true, repositories: true },
      take: 100,
      orderBy: { score: "desc" },
    });

    // Compute fit scores
    const results = candidates
      .map((dev) => computeFitScore(requirements, toDeveloperProfile(dev)))
      .sort((a, b) => b.fitScore - a.fitScore);

    return NextResponse.json({
      requirements,
      candidates: results.map((r) => ({
        developer: r.developer,
        fitScore: r.fitScore,
        matchedLanguages: r.matchedLanguages,
        matchedSkills: r.matchedSkills,
        locationMatch: r.locationMatch,
        reasons: r.reasons,
      })),
      total: results.length,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to match candidates" },
      { status: 500 }
    );
  }
}
