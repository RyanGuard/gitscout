import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getJobDetails } from "@/lib/ashby";

// GET — fetch detailed job info from Ashby (compensation, location, etc.)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: jobId } = await params;

  const connection = await prisma.ashbyConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No Ashby connection found" },
      { status: 400 }
    );
  }

  try {
    const job = await getJobDetails(connection.apiKey, jobId);
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
