import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  enrichOrganization,
  extractInvestors,
  searchPeopleAtCompany,
  isEngineeringRole,
} from "@/lib/connections/apollo";
import { matchGithubProfiles, fetchContributedRepos } from "@/lib/connections/github";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { company_domain } = body;

  if (!company_domain) {
    return Response.json(
      { error: "company_domain is required" },
      { status: 400 }
    );
  }

  const domain = company_domain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");

  try {
    // Check if user already has a home base — update if so
    const existing = await prisma.connectionHomeBase.findFirst({
      where: { userId: session.user.id },
    });

    let homeBase;
    if (existing) {
      // Reset and re-enrich
      homeBase = await prisma.connectionHomeBase.update({
        where: { id: existing.id },
        data: {
          companyDomain: domain,
          companyName: domain.split(".")[0],
          setupStatus: "enriching_team",
          teamCount: 0,
          engCount: 0,
          githubMatchedCount: 0,
          apolloOrgId: null,
          investors: [],
          fundingStage: null,
        },
      });
      // Clear old people and repos
      await prisma.homeBaseGithubRepo.deleteMany({
        where: { homeBaseId: homeBase.id },
      });
      await prisma.homeBasePerson.deleteMany({
        where: { homeBaseId: homeBase.id },
      });
    } else {
      homeBase = await prisma.connectionHomeBase.create({
        data: {
          userId: session.user.id,
          companyName: domain.split(".")[0],
          companyDomain: domain,
          setupStatus: "enriching_team",
        },
      });
    }

    // Return the homeBase ID immediately — enrichment continues async
    const homeBaseId = homeBase.id;

    // Run enrichment in the background (don't await)
    enrichHomeBase(homeBaseId, domain, session.user.id).catch((err) => {
      console.error("[connections] Home base enrichment failed:", err);
    });

    return Response.json({
      id: homeBaseId,
      status: "enriching_team",
      message: "Home base setup started. Poll GET /api/connections/home-base for status.",
    });
  } catch (error) {
    console.error("[connections] Setup home base error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}

async function enrichHomeBase(
  homeBaseId: string,
  domain: string,
  userId: string
) {
  try {
    // Step 1: Enrich the organization
    const org = await enrichOrganization(domain);
    if (org) {
      const investors = extractInvestors(org);
      await prisma.connectionHomeBase.update({
        where: { id: homeBaseId },
        data: {
          companyName: org.name || domain.split(".")[0],
          apolloOrgId: org.id,
          investors,
          fundingStage: org.latest_funding_stage,
        },
      });
    }

    // Step 2: Search for all people at the company (FREE — no credits)
    const people = await searchPeopleAtCompany(domain, {
      perPage: 100,
      maxPages: 2, // Cap at 200 people for large companies
    });

    // Step 3: Store all people with their employment history and education
    const engPeople: Array<{ id: string; person: (typeof people)[0] }> = [];

    for (const person of people) {
      const isEng = isEngineeringRole(person);

      const created = await prisma.homeBasePerson.create({
        data: {
          homeBaseId,
          apolloPersonId: person.id || null,
          name: person.name,
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.title,
          department: person.departments[0] || null,
          seniority: person.seniority,
          linkedinUrl: person.linkedin_url || null,
          education: person.education.length > 0 ? person.education : undefined,
          employmentHistory:
            person.employment_history.length > 0
              ? person.employment_history
              : undefined,
        },
      });

      if (isEng) {
        engPeople.push({ id: created.id, person });
      }
    }

    await prisma.connectionHomeBase.update({
      where: { id: homeBaseId },
      data: {
        teamCount: people.length,
        engCount: engPeople.length,
        setupStatus: "enriching_github",
      },
    });

    // Step 4: GitHub matching for engineering team members
    let githubMatched = 0;

    for (const eng of engPeople) {
      const match = await matchGithubProfiles(eng.person);
      if (match) {
        await prisma.homeBasePerson.update({
          where: { id: eng.id },
          data: {
            githubUsername: match.username,
            githubUrl: `https://github.com/${match.username}`,
            githubConfidence: match.confidence,
          },
        });

        // Fetch contributed repos
        const repos = await fetchContributedRepos(match.username);
        if (repos.length > 0) {
          await prisma.homeBaseGithubRepo.createMany({
            data: repos.map((r) => ({
              homeBaseId,
              personId: eng.id,
              githubUsername: match.username,
              repoFullName: r.fullName,
              repoUrl: r.url,
              contributionType: r.type,
              contributionCount: r.count,
              lastContributedAt: r.lastAt ? new Date(r.lastAt) : null,
            })),
          });
        }

        githubMatched++;
      }

      // Small delay between GitHub API calls to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Step 5: Mark as ready
    await prisma.connectionHomeBase.update({
      where: { id: homeBaseId },
      data: {
        setupStatus: "ready",
        githubMatchedCount: githubMatched,
        lastEnrichedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[connections] Enrichment error:", error);
    await prisma.connectionHomeBase
      .update({
        where: { id: homeBaseId },
        data: { setupStatus: "failed" },
      })
      .catch(() => {});
  }
}
