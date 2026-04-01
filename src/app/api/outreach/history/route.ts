import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const linkedin = searchParams.get("linkedin") || "";
  const email = searchParams.get("email") || "";

  if (!linkedin && !email) {
    return Response.json({ sequences: [] });
  }

  const userId = session.user.id;

  // Build OR conditions for matching
  const orConditions: { candidateLinkedinUrl?: string; candidateEmail?: string }[] = [];
  if (linkedin) {
    orConditions.push({ candidateLinkedinUrl: linkedin });
  }
  if (email) {
    orConditions.push({ candidateEmail: email });
  }

  const sequences = await prisma.outreachSequence.findMany({
    where: {
      userId,
      OR: orConditions,
    },
    include: {
      _count: {
        select: { messages: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = sequences.map((seq) => ({
    id: seq.id,
    channel: seq.channel,
    tone: seq.tone,
    status: seq.status,
    responseReceived: seq.responseReceived,
    responseSentiment: seq.responseSentiment,
    messageCount: seq._count.messages,
    createdAt: seq.createdAt.toISOString(),
  }));

  return Response.json({ sequences: result });
}
