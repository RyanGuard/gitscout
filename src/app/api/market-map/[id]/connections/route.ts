import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;

  // Check user has a ready home base
  const homeBase = await prisma.connectionHomeBase.findFirst({
    where: { userId: session.user.id, setupStatus: "ready" },
  });

  if (!homeBase) {
    return Response.json({ counts: {} });
  }

  // Get all companies on this map
  const companies = await prisma.mapCompany.findMany({
    where: { mapId, hidden: false },
    select: { id: true, companyDomain: true },
  });

  // Check for existing recent lookups
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const existingLookups = await prisma.connectionLookup.findMany({
    where: {
      homeBaseId: homeBase.id,
      mapId,
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      mapCompanyId: true,
      totalConnectionsFound: true,
    },
  });

  const counts: Record<string, number> = {};

  // Use cached results where available
  for (const lookup of existingLookups) {
    if (lookup.mapCompanyId) {
      counts[lookup.mapCompanyId] = lookup.totalConnectionsFound;
    }
  }

  // For companies without recent lookups, check by domain
  const companiesWithoutLookups = companies.filter(
    (c) => !(c.id in counts)
  );

  if (companiesWithoutLookups.length > 0) {
    // Check for lookups by domain (might exist from standalone /connections page)
    const domainLookups = await prisma.connectionLookup.findMany({
      where: {
        homeBaseId: homeBase.id,
        targetCompanyDomain: {
          in: companiesWithoutLookups.map((c) => c.companyDomain),
        },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        targetCompanyDomain: true,
        totalConnectionsFound: true,
      },
    });

    const domainToCount = new Map(
      domainLookups.map((l) => [l.targetCompanyDomain, l.totalConnectionsFound])
    );

    for (const company of companiesWithoutLookups) {
      const count = domainToCount.get(company.companyDomain);
      if (count !== undefined) {
        counts[company.id] = count;
      }
      // Companies without any lookup just won't have a badge — no need to run
      // expensive lookups in bulk on page load. Users can trigger individual
      // lookups from the /connections page.
    }
  }

  return Response.json({ counts });
}
