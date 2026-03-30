import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCandidate, createNote, findOrCreateSource } from "@/lib/ashby";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { sequenceId } = body;

  if (!sequenceId) {
    return Response.json({ error: "Sequence ID is required" }, { status: 400 });
  }

  // Load the sequence with messages
  const sequence = await prisma.outreachSequence.findUnique({
    where: { id: sequenceId },
    include: { messages: true },
  });

  if (!sequence) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Verify ownership
  if (sequence.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Get user's Ashby connection
  const connection = await prisma.ashbyConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection || !connection.isValid) {
    return Response.json(
      { error: "No active Ashby connection. Connect Ashby in Settings first." },
      { status: 400 }
    );
  }

  const apiKey = connection.apiKey;

  try {
    // Ensure a Scout source exists
    let sourceId = connection.sourceId;
    if (!sourceId) {
      try {
        sourceId = await findOrCreateSource(apiKey);
      } catch {
        // Non-critical
      }
    }

    // Create candidate in Ashby
    const { candidateId } = await createCandidate(apiKey, {
      name: sequence.candidateName,
      email: sequence.candidateEmail,
      linkedInUrl: sequence.candidateLinkedinUrl,
      githubUrl: sequence.candidateGithubUrl,
      sourceId,
    });

    // Build note text from the sequence messages
    const sortedMessages = [...sequence.messages].sort((a, b) => a.stepNumber - b.stepNumber);
    const noteLines = [
      `Outreach sequence for ${sequence.candidateName} via ${sequence.channel}:\n`,
    ];
    for (const msg of sortedMessages) {
      noteLines.push(`Step ${msg.stepNumber}: ${msg.body}\n`);
    }
    const noteText = noteLines.join("\n");

    // Create the note on the candidate
    await createNote(apiKey, {
      candidateId,
      note: noteText,
    });

    // Update sequence with ashbyPushedAt timestamp
    await prisma.outreachSequence.update({
      where: { id: sequenceId },
      data: { ashbyPushedAt: new Date() },
    });

    return Response.json({ success: true, candidateId });
  } catch (err) {
    console.error("Ashby log error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: `Ashby log failed: ${message}` }, { status: 500 });
  }
}
