import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["mapped", "shortlisted", "contacted", "responded", "screening", "offer", "rejected"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;
  const body = await request.json().catch(() => ({}));
  const { candidate_ids, update } = body;

  if (!candidate_ids?.length || !update) {
    return Response.json({ error: "candidate_ids and update required" }, { status: 400 });
  }

  if (candidate_ids.length > 100) {
    return Response.json({ error: "Max 100 candidates per bulk update" }, { status: 400 });
  }

  // Validate status if being updated
  if (update.status && !VALID_STATUSES.includes(update.status)) {
    return Response.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  try {
    const result = await prisma.mapCandidate.updateMany({
      where: {
        id: { in: candidate_ids },
        mapId,
      },
      data: update,
    });

    return Response.json({ updated: result.count });
  } catch (error) {
    console.error("[bulk-update] Failed:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Bulk update failed" },
      { status: 500 }
    );
  }
}
