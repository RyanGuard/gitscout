import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const userId = await getAuthUserId(request);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { candidateId, listId } = body;

  if (!candidateId || !listId) {
    return Response.json({ error: "candidateId and listId required" }, { status: 400 });
  }

  try {
    const list = await prisma.candidateList.findUnique({ where: { id: listId, userId } });
    if (!list) return Response.json({ error: "List not found" }, { status: 404 });

    // Get surfaced candidate data
    const candidate = await prisma.surfacedCandidate.findUnique({
      where: { id: candidateId },
      select: { name: true, firstName: true, lastName: true, title: true, city: true, state: true, country: true, linkedinUrl: true, email: true, apolloPersonId: true },
    });
    if (!candidate) return Response.json({ error: "Candidate not found" }, { status: 404 });

    // Find or create Developer record
    let developer = candidate.email
      ? await prisma.developer.findFirst({ where: { email: candidate.email } })
      : null;

    if (!developer) {
      const username = (candidate.name || "unknown").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now().toString(36);
      developer = await prisma.developer.create({
        data: {
          githubId: Math.floor(Math.random() * 900000000) + 100000000,
          username,
          name: candidate.name,
          email: candidate.email,
          company: candidate.title || null,
          location: [candidate.city, candidate.state, candidate.country].filter(Boolean).join(", ") || null,
        },
      });
    }

    // Check for duplicate
    const existing = await prisma.candidateEntry.findFirst({
      where: { listId, developerId: developer.id },
    });
    if (existing) return Response.json({ id: existing.id, alreadyExists: true });

    const entry = await prisma.candidateEntry.create({
      data: { listId, developerId: developer.id, stage: "identified" },
    });

    return Response.json({ id: entry.id, developerId: developer.id }, { status: 201 });
  } catch (error) {
    console.error("[alerts/save-to-list] Failed:", error);
    return Response.json({ error: "Failed to save to list" }, { status: 500 });
  }
}
