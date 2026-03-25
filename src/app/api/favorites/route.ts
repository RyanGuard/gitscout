import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    include: {
      developer: {
        include: {
          languages: { orderBy: { percentage: "desc" }, take: 5 },
          repositories: { orderBy: { stars: "desc" }, take: 3 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ favorites });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { developerId } = await request.json();
  if (!developerId) {
    return Response.json({ error: "developerId required" }, { status: 400 });
  }

  const favorite = await prisma.favorite.create({
    data: { userId: session.user.id, developerId },
  });

  return Response.json(favorite, { status: 201 });
}
