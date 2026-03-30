import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kits = await prisma.sellingPointKit.findMany({
    where: { userId: session.user.id },
    orderBy: { useCount: "desc" },
  });

  return Response.json({ kits });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, roleTitle, points, roleContext } = body;

  if (!name?.trim()) {
    return Response.json({ error: "Kit name is required" }, { status: 400 });
  }

  if (!points?.length) {
    return Response.json({ error: "At least one selling point is required" }, { status: 400 });
  }

  const kit = await prisma.sellingPointKit.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      roleTitle: roleTitle?.trim() || null,
      points,
      roleContext: roleContext || null,
    },
  });

  return Response.json(kit, { status: 201 });
}
