import { prisma } from "@/lib/prisma";

export async function logStatusChange(
  candidateId: string,
  mapId: string,
  fromStatus: string,
  toStatus: string,
  changedBy?: string
) {
  if (fromStatus === toStatus) return;

  await prisma.candidateStatusHistory.create({
    data: {
      candidateId,
      mapId,
      fromStatus,
      toStatus,
      changedBy: changedBy || null,
    },
  });
}
