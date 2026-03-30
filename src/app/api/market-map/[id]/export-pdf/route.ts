import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { MapPdfDocument } from "@/lib/pdf/MapPdfDocument";

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
  const variant = body.variant === "full" ? "full" : "overview";

  // Fetch map with ownership check
  const map = await prisma.marketMap.findFirst({
    where: { id: mapId, userId: session.user.id },
    include: {
      companies: {
        where: { hidden: false },
        include: {
          candidates: {
            orderBy: { fitScore: { sort: "desc", nulls: "last" } },
          },
        },
        orderBy: { tier: "asc" },
      },
    },
  });

  if (!map) {
    return Response.json({ error: "Map not found" }, { status: 404 });
  }

  // Group by tier
  const tiers: Record<string, typeof map.companies> = { A: [], B: [], C: [] };
  for (const co of map.companies) {
    if (tiers[co.tier]) tiers[co.tier].push(co);
  }

  // Compute stats
  const totalCandidates = map.companies.reduce(
    (s, c) => s + c.candidates.length,
    0
  );
  const avgFitScore =
    totalCandidates > 0
      ? Math.round(
          map.companies.reduce(
            (s, c) =>
              s + c.candidates.reduce((cs, p) => cs + (p.fitScore || 0), 0),
            0
          ) / totalCandidates
        )
      : 0;
  const statusCounts: Record<string, number> = {};
  for (const co of map.companies) {
    for (const c of co.candidates) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    }
  }

  // Render PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(MapPdfDocument, {
      variant: variant as "overview" | "full",
      mapName: map.name,
      roleTitle: map.roleTitle,
      roleLevel: map.roleLevel,
      roleStack: map.roleStack,
      geography: map.geography,
      recruiterName: session.user.name || "Scout User",
      tiers,
      stats: {
        totalCompanies: map.companies.length,
        totalCandidates,
        avgFitScore,
        statusCounts,
      },
    }) as any
  );

  const filename = `${map.name.replace(/[^a-zA-Z0-9]/g, "_")}_${variant}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
