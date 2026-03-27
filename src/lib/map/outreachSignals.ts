import { prisma } from "@/lib/prisma";

export async function logOutreachSignal({
  companyDomain,
  candidateSeniority,
  candidateTitleKeywords,
  outreachTone,
  outreachSentAt,
  responseReceived,
  responseTimeHours,
  bounce,
  userId,
}: {
  companyDomain: string;
  candidateSeniority?: string;
  candidateTitleKeywords?: string[];
  outreachTone?: string;
  outreachSentAt?: Date;
  responseReceived?: boolean;
  responseTimeHours?: number;
  bounce?: boolean;
  userId: string;
}) {
  await prisma.outreachSignal.create({
    data: {
      companyDomain,
      candidateSeniority: candidateSeniority || null,
      candidateTitleKeywords: candidateTitleKeywords || [],
      outreachTone: outreachTone || null,
      outreachSentAt: outreachSentAt || null,
      responseReceived: responseReceived || false,
      responseTimeHours: responseTimeHours || null,
      bounce: bounce || false,
      userId,
    },
  });
}
