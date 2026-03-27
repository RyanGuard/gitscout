import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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

  // Verify map ownership
  const map = await prisma.marketMap.findFirst({
    where: { id: mapId, userId: session.user.id },
    select: { id: true, name: true },
  });
  if (!map) {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  const permissionLevel = body.permission_level === "full" ? "full" : "overview";
  const recipientName = body.recipient_name || null;
  const recipientEmail = body.recipient_email || null;
  const expiresDays = body.expires_days || 30;

  const shareToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000);

  const share = await prisma.mapShare.create({
    data: {
      mapId,
      userId: session.user.id,
      shareToken,
      permissionLevel,
      recipientName,
      recipientEmail,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gitscout.dev";

  return Response.json({
    share_url: `${baseUrl}/share/${shareToken}`,
    share_token: shareToken,
    expires_at: share.expiresAt,
    permission_level: share.permissionLevel,
    id: share.id,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;

  const shares = await prisma.mapShare.findMany({
    where: { mapId, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shareToken: true,
      permissionLevel: true,
      recipientName: true,
      recipientEmail: true,
      expiresAt: true,
      viewCount: true,
      lastViewedAt: true,
      createdAt: true,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gitscout.dev";
  const sharesWithUrls = shares.map((s) => ({
    ...s,
    share_url: `${baseUrl}/share/${s.shareToken}`,
    expired: s.expiresAt ? new Date(s.expiresAt) < new Date() : false,
  }));

  return Response.json({ shares: sharesWithUrls });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.share_id) {
    return Response.json({ error: "share_id required" }, { status: 400 });
  }

  const deleted = await prisma.mapShare.deleteMany({
    where: {
      id: body.share_id,
      mapId,
      userId: session.user.id,
    },
  });

  if (deleted.count === 0) {
    return Response.json({ error: "Share not found" }, { status: 404 });
  }

  return Response.json({ success: true });
}
