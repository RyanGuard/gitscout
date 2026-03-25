import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncOneUser } from "@/pipeline/github";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await request.json();
  if (!username) {
    return Response.json({ error: "username required" }, { status: 400 });
  }

  // Check if already indexed
  const existing = await prisma.developer.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existing) {
    return Response.json({ id: existing.id, indexed: true });
  }

  // Index on demand
  const developer = await syncOneUser(username);
  if (!developer) {
    return Response.json({ error: "Could not fetch from GitHub" }, { status: 404 });
  }

  return Response.json({ id: developer.id, indexed: true });
}
