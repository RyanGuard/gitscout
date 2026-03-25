import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCandidate, createApplication } from "@/lib/ashby";

// POST — push a developer to Ashby as a candidate
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { developerId, jobId } = body as {
    developerId: string;
    jobId?: string;
  };

  if (!developerId) {
    return NextResponse.json(
      { error: "developerId is required" },
      { status: 400 }
    );
  }

  const connection = await prisma.ashbyConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return NextResponse.json(
      { error: "No Ashby connection. Connect in Settings first." },
      { status: 400 }
    );
  }

  const developer = await prisma.developer.findUnique({
    where: { id: developerId },
    include: { contactInfo: true },
  });

  if (!developer) {
    return NextResponse.json(
      { error: "Developer not found" },
      { status: 404 }
    );
  }

  // Check for duplicate push (same user + developer + job)
  const existing = await prisma.ashbyPush.findFirst({
    where: {
      userId: session.user.id,
      developerId,
      jobId: jobId || null,
      status: { in: ["pushed", "applied"] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "This developer has already been pushed to Ashby for this job" },
      { status: 409 }
    );
  }

  // Create the push record as pending
  const push = await prisma.ashbyPush.create({
    data: {
      userId: session.user.id,
      developerId,
      jobId: jobId || null,
      status: "pending",
    },
  });

  try {
    const displayName =
      developer.name || developer.username;
    const email =
      developer.contactInfo?.primaryEmail || developer.email;
    const linkedInUrl = developer.contactInfo?.linkedinUrl || null;
    const phone = developer.contactInfo?.phone || null;

    // Create candidate in Ashby
    const { candidateId } = await createCandidate(connection.apiKey, {
      name: displayName,
      email,
      phone,
      linkedInUrl,
      githubUrl: `https://github.com/${developer.username}`,
      sourceId: connection.sourceId,
    });

    let applicationId: string | null = null;

    // If a job was selected, create an application
    if (jobId) {
      const result = await createApplication(connection.apiKey, {
        candidateId,
        jobId,
        sourceId: connection.sourceId,
      });
      applicationId = result.applicationId;
    }

    // Update push record with success
    await prisma.ashbyPush.update({
      where: { id: push.id },
      data: {
        ashbyCandidateId: candidateId,
        ashbyApplicationId: applicationId,
        status: jobId ? "applied" : "pushed",
        pushedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      candidateId,
      applicationId,
      status: jobId ? "applied" : "pushed",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to push to Ashby";

    await prisma.ashbyPush.update({
      where: { id: push.id },
      data: { status: "error", errorMessage: message },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
