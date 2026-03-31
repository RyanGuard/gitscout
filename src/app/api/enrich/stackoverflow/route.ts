import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { enrichStackOverflow } from "@/lib/intelligence/stackOverflow";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name = request.nextUrl.searchParams.get("name");
  if (!name) {
    return NextResponse.json(
      { error: "name query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const profile = await enrichStackOverflow(name);

    if (!profile) {
      return NextResponse.json(
        { error: "No Stack Overflow user found" },
        { status: 404 }
      );
    }

    // Try to match to an existing Developer by name similarity
    let matchedDeveloper: { id: string; username: string } | null = null;
    try {
      const developer = await prisma.developer.findFirst({
        where: {
          OR: [
            { name: { equals: profile.displayName, mode: "insensitive" } },
            { username: { equals: name, mode: "insensitive" } },
          ],
        },
        select: { id: true, username: true },
      });

      if (developer) {
        matchedDeveloper = developer;
      }
    } catch {
      // Developer matching is best-effort
    }

    return NextResponse.json({
      profile,
      matchedDeveloper,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Stack Overflow enrichment failed",
      },
      { status: 500 }
    );
  }
}
