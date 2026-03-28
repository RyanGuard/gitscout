import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { buildCandidateContext } from "@/lib/sequences/buildContext";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const sequence = await prisma.sequence.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  if (!sequence) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (sequence.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const candidates: Array<{
    type: "map_candidate" | "developer" | "candidate_entry";
    id: string;
  }> = body.candidates || [];

  if (candidates.length === 0) {
    return NextResponse.json({ error: "No candidates provided" }, { status: 400 });
  }

  if (candidates.length > 50) {
    return NextResponse.json({ error: "Max 50 candidates per batch" }, { status: 400 });
  }

  const enrolled: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const candidate of candidates) {
    try {
      const ctx = await buildCandidateContext(candidate, session.user.id);

      if (!ctx) {
        skipped.push({ id: candidate.id, reason: "Could not resolve candidate" });
        continue;
      }

      if (!ctx.email) {
        skipped.push({ id: candidate.id, reason: "No email available" });
        continue;
      }

      // Check for existing enrollment (dedup by email)
      const existing = await prisma.sequenceEnrollment.findUnique({
        where: {
          sequenceId_candidateEmail: {
            sequenceId: id,
            candidateEmail: ctx.email,
          },
        },
      });

      if (existing) {
        skipped.push({ id: candidate.id, reason: "Already enrolled" });
        continue;
      }

      // Calculate nextSendAt based on first step delay
      const firstStep = sequence.steps[0];
      const nextSendAt = firstStep
        ? new Date(Date.now() + firstStep.delayDays * 24 * 60 * 60 * 1000)
        : null;

      await prisma.sequenceEnrollment.create({
        data: {
          sequenceId: id,
          candidateEmail: ctx.email,
          candidateName: ctx.name,
          candidateTitle: ctx.title,
          candidateCompany: ctx.company,
          candidateLinkedinUrl: ctx.linkedinUrl,
          mapCandidateId:
            candidate.type === "map_candidate" ? candidate.id : undefined,
          developerId:
            candidate.type === "developer" ? candidate.id : undefined,
          candidateEntryId:
            candidate.type === "candidate_entry" ? candidate.id : undefined,
          candidateContext: JSON.parse(JSON.stringify(ctx)),
          nextSendAt: sequence.status === "active" ? nextSendAt : null,
        },
      });

      enrolled.push(ctx.email);
    } catch (err) {
      skipped.push({
        id: candidate.id,
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Update totalEnrolled count
  await prisma.sequence.update({
    where: { id },
    data: { totalEnrolled: { increment: enrolled.length } },
  });

  return NextResponse.json({
    enrolled: enrolled.length,
    skipped,
  });
}
