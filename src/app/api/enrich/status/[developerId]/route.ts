import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ developerId: string }> },
) {
  const { developerId } = await params;

  const contactInfo = await prisma.contactInfo.findUnique({
    where: { developerId },
  });

  if (!contactInfo) {
    return Response.json({ enriched: false, contactInfo: null });
  }

  return Response.json({
    enriched: true,
    contactInfo: {
      id: contactInfo.id,
      emails: contactInfo.emails,
      primaryEmail: contactInfo.primaryEmail,
      phone: contactInfo.phone,
      linkedinUrl: contactInfo.linkedinUrl,
      twitterUrl: contactInfo.twitterUrl,
      mastodonUrl: contactInfo.mastodonUrl,
      devtoUrl: contactInfo.devtoUrl,
      mediumUrl: contactInfo.mediumUrl,
      personalSite: contactInfo.personalSite,
      photoUrl: contactInfo.photoUrl,
      currentTitle: contactInfo.currentTitle,
      headline: contactInfo.headline,
      normalizedCompany: contactInfo.normalizedCompany,
      seniorityLevel: contactInfo.seniorityLevel,
      employmentHistory: contactInfo.employmentHistory,
      enrichedAt: contactInfo.enrichedAt?.toISOString() || null,
      enrichmentSource: contactInfo.enrichmentSource,
    },
  });
}
