import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateApiKey, findOrCreateSource } from "@/lib/ashby";

// GET — check if user has an Ashby connection
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.ashbyConnection.findUnique({
    where: { userId: session.user.id },
    select: { id: true, isValid: true, sourceId: true, createdAt: true },
  });

  return NextResponse.json({ connected: !!connection, connection });
}

// POST — save / validate Ashby API key
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const apiKey = body.apiKey as string | undefined;

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return NextResponse.json(
      { error: "API key is required" },
      { status: 400 }
    );
  }

  const { valid, organizationName } = await validateApiKey(apiKey.trim());
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid Ashby API key" },
      { status: 400 }
    );
  }

  // Ensure a GitScout source exists in their Ashby org
  let sourceId: string | null = null;
  try {
    sourceId = await findOrCreateSource(apiKey.trim());
  } catch {
    // Non-critical — push will still work without a source
  }

  const connection = await prisma.ashbyConnection.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      apiKey: apiKey.trim(),
      sourceId,
      isValid: true,
    },
    update: {
      apiKey: apiKey.trim(),
      sourceId,
      isValid: true,
    },
  });

  return NextResponse.json({
    connected: true,
    organizationName,
    connectionId: connection.id,
  });
}

// DELETE — remove Ashby connection
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.ashbyConnection.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ disconnected: true });
}
