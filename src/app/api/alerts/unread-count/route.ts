import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.marketSignal.count({
    where: {
      userId: session.user.id,
      isRead: false,
      isDismissed: false,
    },
  });

  return NextResponse.json({ count });
}
