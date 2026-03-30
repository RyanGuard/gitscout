import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;

  const list = await prisma.candidateList.findUnique({
    where: { id: listId, userId: session.user.id },
    include: {
      entries: {
        include: {
          developer: {
            include: {
              languages: { take: 3, orderBy: { percentage: "desc" } },
              contactInfo: true,
            },
          },
          tags: true,
          notes: { take: 1, orderBy: { createdAt: "desc" } },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  return Response.json({
    id: list.id,
    name: list.name,
    description: list.description,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
    entries: list.entries.map((e) => ({
      id: e.id,
      stage: e.stage,
      addedAt: e.addedAt.toISOString(),
      developer: {
        id: e.developer.id,
        githubId: e.developer.githubId,
        username: e.developer.username,
        name: e.developer.name,
        avatarUrl: e.developer.avatarUrl,
        bio: e.developer.bio,
        location: e.developer.location,
        company: e.developer.company,
        publicRepos: e.developer.publicRepos,
        followers: e.developer.followers,
        totalStars: e.developer.totalStars,
        score: e.developer.score,
        hireable: e.developer.hireable,
        primaryLanguage: e.developer.primaryLanguage,
        totalCommits: e.developer.totalCommits,
        following: e.developer.following,
        languages: e.developer.languages,
        repositories: [],
        contactInfo: e.developer.contactInfo ? {
          primaryEmail: e.developer.contactInfo.primaryEmail,
          emails: e.developer.contactInfo.emails,
          phone: e.developer.contactInfo.phone,
          linkedinUrl: e.developer.contactInfo.linkedinUrl,
          twitterUrl: e.developer.contactInfo.twitterUrl,
          currentTitle: e.developer.contactInfo.currentTitle,
          headline: e.developer.contactInfo.headline,
          normalizedCompany: e.developer.contactInfo.normalizedCompany,
          seniorityLevel: e.developer.contactInfo.seniorityLevel,
          employmentHistory: e.developer.contactInfo.employmentHistory,
          photoUrl: e.developer.contactInfo.photoUrl,
          enrichedAt: e.developer.contactInfo.enrichedAt?.toISOString() ?? null,
          enrichmentSource: e.developer.contactInfo.enrichmentSource,
        } : null,
      },
      tags: e.tags.map((t) => t.tag),
      lastNote: e.notes[0]?.content ?? null,
    })),
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;

  const existing = await prisma.candidateList.findUnique({
    where: { id: listId, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  const { name, description } = await request.json();
  const data: Record<string, string | null> = {};
  if (name !== undefined) data.name = name.trim();
  if (description !== undefined) data.description = description?.trim() || null;

  const updated = await prisma.candidateList.update({
    where: { id: listId },
    data,
  });

  return Response.json({
    id: updated.id,
    name: updated.name,
    description: updated.description,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;

  const existing = await prisma.candidateList.findUnique({
    where: { id: listId, userId: session.user.id },
  });
  if (!existing) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  await prisma.candidateList.delete({ where: { id: listId } });

  return Response.json({ success: true });
}
