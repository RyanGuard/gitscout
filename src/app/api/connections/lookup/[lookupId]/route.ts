import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lookupId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { lookupId } = await params;

  const lookup = await prisma.connectionLookup.findUnique({
    where: { id: lookupId },
    include: {
      connections: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!lookup) {
    return Response.json({ error: "Lookup not found" }, { status: 404 });
  }

  if (lookup.userId !== session.user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  return Response.json({
    id: lookup.id,
    targetCompanyName: lookup.targetCompanyName,
    targetCompanyDomain: lookup.targetCompanyDomain,
    totalConnectionsFound: lookup.totalConnectionsFound,
    connectionBreakdown: lookup.connectionBreakdown,
    connections: lookup.connections,
  });
}
