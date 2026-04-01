import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { stage } = body as { stage?: string };

  if (!stage) {
    return Response.json({ error: "Missing stage" }, { status: 400 });
  }

  const validStages = [
    "draft",
    "sourced",
    "outreach_sent",
    "responded",
    "interested",
    "in_ats",
    "passed",
  ];
  if (!validStages.includes(stage)) {
    return Response.json({ error: "Invalid stage" }, { status: 400 });
  }

  const userId = session.user.id;

  // "sourced" candidates are list entries, not outreach sequences.
  // Moving FROM sourced to another stage is not supported via this endpoint
  // (the candidate would need an OutreachSequence created first).
  // Moving TO sourced is also not meaningful.
  if (stage === "sourced") {
    return Response.json({ error: "Cannot move to sourced stage" }, { status: 400 });
  }

  // Verify the sequence belongs to this user
  const sequence = await prisma.outreachSequence.findFirst({
    where: { id, userId },
  });

  if (!sequence) {
    return Response.json({ error: "Sequence not found" }, { status: 404 });
  }

  // Build the update based on the target stage
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: Record<string, any> = {};

  switch (stage) {
    case "draft":
      update.status = "draft";
      update.responseReceived = false;
      update.responseSentiment = null;
      update.ashbyPushedAt = null;
      break;
    case "outreach_sent":
      update.status = "sending";
      break;
    case "responded":
      update.responseReceived = true;
      break;
    case "interested":
      update.responseReceived = true;
      update.responseSentiment = "positive";
      break;
    case "in_ats":
      update.ashbyPushedAt = new Date();
      break;
    case "passed":
      update.status = "completed";
      update.responseSentiment = "negative";
      break;
  }

  const updated = await prisma.outreachSequence.update({
    where: { id },
    data: update,
  });

  return Response.json({ success: true, id: updated.id, stage });
}
