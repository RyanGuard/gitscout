import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PipelineCandidate {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  channel: string;
  linkedinUrl: string | null;
  sequenceId: string | null;
  daysInStage: number;
  stage: string;
}

interface PipelineStage {
  id: string;
  label: string;
  candidates: PipelineCandidate[];
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  // Fetch all OutreachSequences for the user
  const sequences = await prisma.outreachSequence.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  // Fetch all CandidateEntries from user's lists (for "Sourced" column)
  const lists = await prisma.candidateList.findMany({
    where: { userId },
    include: {
      entries: {
        include: {
          developer: {
            include: { contactInfo: true },
          },
        },
      },
    },
  });

  // Collect all developer IDs that already have an outreach sequence
  const developersWithSequences = new Set(
    sequences
      .map((s) => s.sourceDeveloperId)
      .filter((id): id is string => id !== null),
  );

  // Sourced: candidates in lists that have no outreach sequence
  const sourcedCandidates: PipelineCandidate[] = [];
  const seenDeveloperIds = new Set<string>();

  for (const list of lists) {
    for (const entry of list.entries) {
      if (
        !developersWithSequences.has(entry.developerId) &&
        !seenDeveloperIds.has(entry.developerId)
      ) {
        seenDeveloperIds.add(entry.developerId);
        const dev = entry.developer;
        const daysSinceAdded = Math.floor(
          (now.getTime() - entry.addedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        sourcedCandidates.push({
          id: entry.id,
          name: dev.name || dev.username,
          title: dev.contactInfo?.currentTitle || null,
          company: dev.contactInfo?.normalizedCompany || dev.company || null,
          channel: "github",
          linkedinUrl: dev.contactInfo?.linkedinUrl || null,
          sequenceId: null,
          daysInStage: daysSinceAdded,
          stage: "sourced",
        });
      }
    }
  }

  // Classify sequences into pipeline stages
  const drafts: PipelineCandidate[] = [];
  const outreachSent: PipelineCandidate[] = [];
  const responded: PipelineCandidate[] = [];
  const interested: PipelineCandidate[] = [];
  const inAts: PipelineCandidate[] = [];
  const passed: PipelineCandidate[] = [];

  for (const seq of sequences) {
    const daysInStage = Math.floor(
      (now.getTime() - seq.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    const candidate: PipelineCandidate = {
      id: seq.id,
      name: seq.candidateName,
      title: seq.candidateTitle,
      company: seq.candidateCompany,
      channel: seq.channel,
      linkedinUrl: seq.candidateLinkedinUrl,
      sequenceId: seq.id,
      daysInStage,
      stage: "", // will be set below
    };

    // In ATS takes priority
    if (seq.ashbyPushedAt) {
      candidate.stage = "in_ats";
      inAts.push(candidate);
    } else if (seq.responseSentiment === "positive") {
      candidate.stage = "interested";
      interested.push(candidate);
    } else if (
      seq.responseSentiment === "negative" ||
      (seq.status === "completed" && !seq.responseReceived)
    ) {
      candidate.stage = "passed";
      passed.push(candidate);
    } else if (seq.responseReceived) {
      candidate.stage = "responded";
      responded.push(candidate);
    } else if (seq.status === "sending") {
      candidate.stage = "outreach_sent";
      outreachSent.push(candidate);
    } else if (seq.status === "draft" || seq.status === "ready") {
      candidate.stage = "draft";
      drafts.push(candidate);
    }
  }

  const stages: PipelineStage[] = [
    { id: "draft", label: "Drafts", candidates: drafts },
    { id: "sourced", label: "Sourced", candidates: sourcedCandidates },
    { id: "outreach_sent", label: "Outreach Sent", candidates: outreachSent },
    { id: "responded", label: "Responded", candidates: responded },
    { id: "interested", label: "Interested", candidates: interested },
    { id: "in_ats", label: "In ATS", candidates: inAts },
    { id: "passed", label: "Passed", candidates: passed },
  ];

  return Response.json({ stages });
}
