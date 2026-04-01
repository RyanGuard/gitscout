import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeErrorMessage } from "@/lib/api-error";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { templateId } = await params;

  try {
    const template = await prisma.mapTemplate.findFirst({
      where: { id: templateId, userId: session.user.id },
    });

    if (!template) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }

    const roleConfig = template.roleConfig as Record<string, unknown>;
    const companyConfig = template.companyConfig as Array<{
      company_name: string;
      company_domain: string;
      tier: string;
      tier_override: boolean;
      apollo_org_id: string | null;
    }>;

    // Create new map from template
    const map = await prisma.marketMap.create({
      data: {
        userId: session.user.id,
        name: `${template.name} (copy)`,
        roleTitle: (roleConfig.role_title as string) || template.name,
        roleLevel: (roleConfig.role_level as string) || null,
        roleStack: (roleConfig.role_stack as string[]) || [],
        roleDescription: (roleConfig.role_description as string) || null,
        geography: (roleConfig.geography as string[]) || [],
        compRangeMin: (roleConfig.comp_range_min as number) || null,
        compRangeMax: (roleConfig.comp_range_max as number) || null,
        status: "generating",
      },
    });

    // Create companies from template (preserving tiers)
    const companies = await Promise.all(
      companyConfig.map((co) =>
        prisma.mapCompany.create({
          data: {
            mapId: map.id,
            companyName: co.company_name,
            companyDomain: co.company_domain,
            tier: co.tier,
            tierOverride: co.tier_override,
            enrichmentStatus: "pending",
            apolloOrgId: co.apollo_org_id || null,
          },
        })
      )
    );

    // Update map status
    await prisma.marketMap.update({
      where: { id: map.id },
      data: { status: "ready" },
    });

    // Increment use count
    await prisma.mapTemplate.update({
      where: { id: templateId },
      data: { useCount: { increment: 1 } },
    });

    return Response.json({
      mapId: map.id,
      companies: companies.map((c) => ({
        id: c.id,
        name: c.companyName,
        domain: c.companyDomain,
        tier: c.tier,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: safeErrorMessage(error, "Clone failed") },
      { status: 500 }
    );
  }
}
