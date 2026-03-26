import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — list all templates for the user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.mapTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ templates });
}

// POST — save a map as a template
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { map_id, name } = body;

  if (!map_id) {
    return Response.json({ error: "map_id required" }, { status: 400 });
  }

  try {
    const map = await prisma.marketMap.findFirst({
      where: { id: map_id, userId: session.user.id },
      include: { companies: { where: { hidden: false } } },
    });

    if (!map) {
      return Response.json({ error: "Map not found" }, { status: 404 });
    }

    const roleConfig = {
      role_title: map.roleTitle,
      role_level: map.roleLevel,
      role_stack: map.roleStack,
      geography: map.geography,
      comp_range_min: map.compRangeMin,
      comp_range_max: map.compRangeMax,
      role_description: map.roleDescription,
    };

    const companyConfig = map.companies.map((co) => ({
      company_name: co.companyName,
      company_domain: co.companyDomain,
      tier: co.tier,
      tier_override: co.tierOverride,
      apollo_org_id: co.apolloOrgId,
    }));

    const template = await prisma.mapTemplate.create({
      data: {
        userId: session.user.id,
        name: name || map.roleTitle,
        roleConfig: roleConfig as object,
        companyConfig: companyConfig as object,
        sourceMapId: map.id,
      },
    });

    return Response.json({ id: template.id, name: template.name });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save template" },
      { status: 500 }
    );
  }
}
