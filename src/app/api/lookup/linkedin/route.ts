import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

const APOLLO_API = "https://api.apollo.io/api/v1";

/**
 * POST /api/lookup/linkedin
 * Takes a LinkedIn URL, resolves the person via Apollo, tries to find GitHub,
 * creates/updates a Developer profile, and returns the enriched result.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { linkedin_url } = body;

  if (!linkedin_url || !linkedin_url.includes("linkedin.com/in/")) {
    return NextResponse.json(
      { error: "Valid LinkedIn profile URL required (linkedin.com/in/...)" },
      { status: 400 }
    );
  }

  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "APOLLO_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Step 1: Resolve person via Apollo using LinkedIn URL
    const apolloRes = await fetch(`${APOLLO_API}/people/match`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ linkedin_url }),
    });

    if (!apolloRes.ok) {
      return NextResponse.json(
        { error: "Could not resolve this LinkedIn profile. They may not be in Apollo's database." },
        { status: 404 }
      );
    }

    const apolloData = await apolloRes.json();
    const person = apolloData.person;

    if (!person) {
      return NextResponse.json(
        { error: "No matching person found for this LinkedIn URL." },
        { status: 404 }
      );
    }

    const name = [person.first_name, person.last_name].filter(Boolean).join(" ") || "Unknown";
    const email = person.email || null;
    const phone = person.phone_numbers?.[0]?.sanitized_number || null;
    const title = person.title || null;
    const headline = person.headline || null;
    const company = person.organization_name || null;
    const city = person.city || null;
    const state = person.state || null;
    const country = person.country || null;
    const photoUrl = person.photo_url || null;
    const seniority = person.seniority || null;
    const twitterUrl = person.twitter_url || null;
    const githubUrl = person.github_url || null;
    const employmentHistory = person.employment_history || [];

    // Step 2: Try to find GitHub profile
    let githubUsername: string | null = null;
    let developer = null;

    // Check if Apollo returned a GitHub URL
    if (githubUrl) {
      const match = githubUrl.match(/github\.com\/([^/?#]+)/);
      if (match) githubUsername = match[1];
    }

    // If no GitHub from Apollo, try to find by email in our database
    if (!githubUsername && email) {
      const existingDev = await prisma.developer.findFirst({
        where: { email },
      });
      if (existingDev) {
        githubUsername = existingDev.username;
        developer = existingDev;
      }
    }

    // If no GitHub from Apollo, try to find by name + company
    if (!githubUsername && name && company) {
      const existingDev = await prisma.developer.findFirst({
        where: {
          name: { contains: name.split(" ")[0], mode: "insensitive" },
          company: { contains: company.split(" ")[0], mode: "insensitive" },
        },
      });
      if (existingDev) {
        githubUsername = existingDev.username;
        developer = existingDev;
      }
    }

    // Step 3: If we found a GitHub username, fetch/index the profile
    if (githubUsername && !developer) {
      developer = await prisma.developer.findUnique({
        where: { username: githubUsername },
      });

      // If not in our DB, try to index from GitHub
      if (!developer) {
        try {
          const ghRes = await fetch(`https://api.github.com/users/${githubUsername}`, {
            headers: process.env.GITHUB_TOKEN
              ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
              : {},
          });
          if (ghRes.ok) {
            const ghData = await ghRes.json();
            developer = await prisma.developer.upsert({
              where: { username: githubUsername },
              create: {
                githubId: ghData.id,
                username: ghData.login,
                name: ghData.name || name,
                email: ghData.email || email,
                avatarUrl: ghData.avatar_url,
                bio: ghData.bio,
                company: ghData.company || company,
                location: ghData.location || [city, state].filter(Boolean).join(", "),
                blog: ghData.blog,
                twitterUsername: ghData.twitter_username,
                publicRepos: ghData.public_repos || 0,
                followers: ghData.followers || 0,
                following: ghData.following || 0,
                hireable: ghData.hireable || false,
              },
              update: {
                name: ghData.name || name,
                email: ghData.email || email,
                avatarUrl: ghData.avatar_url,
              },
            });
          }
        } catch {
          // GitHub lookup failed — continue without it
        }
      }
    }

    // Step 4: Store/update ContactInfo with Apollo data
    if (developer) {
      await prisma.contactInfo.upsert({
        where: { developerId: developer.id },
        create: {
          developerId: developer.id,
          linkedinUrl: linkedin_url,
          primaryEmail: email,
          phone,
          twitterUrl,
          photoUrl,
          currentTitle: title,
          headline,
          normalizedCompany: company,
          seniorityLevel: seniority,
          employmentHistory: employmentHistory,
          enrichedAt: new Date(),
          enrichmentSource: "apollo_linkedin_lookup",
        },
        update: {
          linkedinUrl: linkedin_url,
          primaryEmail: email || undefined,
          phone: phone || undefined,
          twitterUrl: twitterUrl || undefined,
          photoUrl: photoUrl || undefined,
          currentTitle: title || undefined,
          headline: headline || undefined,
          normalizedCompany: company || undefined,
          seniorityLevel: seniority || undefined,
          employmentHistory: employmentHistory,
          enrichedAt: new Date(),
          enrichmentSource: "apollo_linkedin_lookup",
        },
      });
    }

    return NextResponse.json({
      person: {
        name,
        email,
        phone,
        title,
        headline,
        company,
        city,
        state,
        country,
        photoUrl,
        seniority,
        linkedinUrl: linkedin_url,
        twitterUrl,
        githubUsername,
        employmentHistory: employmentHistory.slice(0, 5),
      },
      developer: developer
        ? {
            id: developer.id,
            username: developer.username,
            score: developer.score,
            avatarUrl: developer.avatarUrl,
            profileUrl: `/profile/${developer.username}`,
          }
        : null,
      source: "apollo",
    });
  } catch (error) {
    console.error("[lookup/linkedin] Failed:", error);
    return NextResponse.json(
      { error: "Lookup failed. Please try again." },
      { status: 500 }
    );
  }
}
