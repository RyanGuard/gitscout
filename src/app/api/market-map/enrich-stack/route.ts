import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCached, setCache } from "@/lib/connections/cache";
import { scanATSBoards, type ATSScanResult } from "@/lib/map/atsScanner";
import {
  detectGitHubStack,
  type GitHubStackResult,
} from "@/lib/map/githubStackDetector";
import { mergeStackSignals } from "@/lib/map/stackMerger";

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { company_id, company_name, company_domain } = body;

  if (!company_id || !company_name || !company_domain) {
    return Response.json(
      { error: "company_id, company_name, and company_domain are required" },
      { status: 400 }
    );
  }

  // Verify company exists and belongs to user's map
  const company = await prisma.mapCompany.findUnique({
    where: { id: company_id },
    include: { map: { select: { userId: true } } },
  });

  if (!company || company.map.userId !== userId) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  try {
    // Mark as scanning
    await prisma.mapCompany.update({
      where: { id: company_id },
      data: { stackScanStatus: "scanning" },
    });

    // Check caches
    const atsCacheKey = `stack_ats:${company_domain.toLowerCase()}`;
    const githubCacheKey = `stack_github:${company_domain.toLowerCase()}`;

    let atsResult = await getCached<ATSScanResult>(atsCacheKey);
    let githubResult = await getCached<GitHubStackResult>(githubCacheKey);

    // Fetch uncached sources in parallel
    const promises: Array<Promise<void>> = [];

    if (atsResult === null) {
      promises.push(
        scanATSBoards(company_name, company_domain).then((result) => {
          atsResult = result;
          if (result) setCache(atsCacheKey, "stack_scan", result);
        })
      );
    }

    if (githubResult === null) {
      promises.push(
        detectGitHubStack(company_name, company_domain).then((result) => {
          githubResult = result;
          if (result) setCache(githubCacheKey, "stack_scan", result);
        })
      );
    }

    await Promise.allSettled(promises);

    // Merge with existing Apollo tech stack
    const apolloStack = company.techStack || [];
    const merged = mergeStackSignals(atsResult, githubResult, apolloStack);

    // Update company
    await prisma.mapCompany.update({
      where: { id: company_id },
      data: {
        techStackVerified: merged.techStackVerified,
        techStackSources: merged.techStackSources,
        stackConfidence: merged.stackConfidence,
        jdCount: merged.jdCount,
        stackScanStatus: "complete",
        lastStackScanAt: new Date(),
      },
    });

    return Response.json({
      techStackVerified: merged.techStackVerified,
      stackConfidence: merged.stackConfidence,
      techStackSources: merged.techStackSources,
      jdCount: merged.jdCount,
      sources: {
        ats: atsResult
          ? { source: atsResult.source, boardToken: atsResult.boardToken, jobCount: atsResult.jobCount }
          : null,
        github: githubResult
          ? { orgName: githubResult.orgName, repoCount: githubResult.repoCount }
          : null,
        apollo: apolloStack.length,
      },
    });
  } catch (error) {
    console.error("[enrich-stack] Failed:", error);

    await prisma.mapCompany
      .update({
        where: { id: company_id },
        data: { stackScanStatus: "failed" },
      })
      .catch(() => {});

    return Response.json(
      { error: error instanceof Error ? error.message : "Stack scan failed" },
      { status: 500 }
    );
  }
}
