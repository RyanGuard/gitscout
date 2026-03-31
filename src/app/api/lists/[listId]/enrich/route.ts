import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichDeveloper } from "@/pipeline/enrichment";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;

  // Verify the list belongs to this user
  const list = await prisma.candidateList.findUnique({
    where: { id: listId, userId: session.user.id },
    include: {
      entries: {
        include: {
          developer: {
            include: { contactInfo: true },
          },
        },
      },
    },
  });

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  // Filter to entries without enrichment
  const unenriched = list.entries.filter(
    (entry) => !entry.developer.contactInfo?.enrichedAt,
  );

  const toProcess = unenriched.slice(0, 20);
  const skipped = list.entries.length - unenriched.length;

  let enriched = 0;
  let failed = 0;

  // Process sequentially to respect Apollo rate limits
  for (const entry of toProcess) {
    try {
      await enrichDeveloper(entry.developerId);
      enriched++;
    } catch (error) {
      failed++;
      console.error(
        `[bulk-enrich] Failed for developer ${entry.developerId}:`,
        error instanceof Error ? error.message : error,
      );
    }

    // 1-second delay between enrichments to respect rate limits
    if (entry !== toProcess[toProcess.length - 1]) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return Response.json({ enriched, skipped, failed });
}
