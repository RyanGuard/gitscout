import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sequenceId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sequenceId } = await params;

  // Verify sequence ownership
  const sequence = await prisma.outreachSequence.findFirst({
    where: { id: sequenceId, userId: session.user.id },
  });
  if (!sequence) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const actions = await prisma.$queryRaw<
    Array<{
      id: string;
      action_type: string;
      status: string;
      target_name: string;
      scheduled_for: Date;
      executed_at: Date | null;
    }>
  >`
    SELECT id, action_type, status, target_name, scheduled_for, executed_at
    FROM linkedin_action_queue
    WHERE sequence_id = ${sequenceId}
    ORDER BY scheduled_for ASC
  `;

  return Response.json({
    actions: actions.map((a) => ({
      id: a.id,
      action_type: a.action_type,
      status: a.status,
      target_name: a.target_name,
      scheduled_for: a.scheduled_for,
      executed_at: a.executed_at,
    })),
  });
}
