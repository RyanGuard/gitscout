import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const sequence = await prisma.sequence.findUnique({ where: { id } });
  if (!sequence) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId: id },
    include: {
      messages: {
        orderBy: { stepOrder: "asc" },
      },
    },
    orderBy: { enrolledAt: "desc" },
  });

  return NextResponse.json({ enrollments });
}
