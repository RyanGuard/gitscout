import { getAuthUserId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import * as ReactPDF from "@react-pdf/renderer";
import React, { type ReactElement } from "react";
import { MapPdfDocument } from "@/lib/pdf/MapPdfDocument";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: mapId } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const variant = body.variant === "full" ? "full" : "overview";

    // Fetch map with ownership check
    const map = await prisma.marketMap.findFirst({
      where: { id: mapId, userId },
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

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

    const doc = React.createElement(MapPdfDocument, {
      variant: variant as "overview" | "full",
      mapName: map.name,
      roleTitle: map.roleTitle,
      roleLevel: map.roleLevel,
      roleStack: map.roleStack,
      geography: map.geography,
      recruiterName: user?.name || "Scout User",
      tiers,
      stats: {
        totalCompanies: map.companies.length,
        totalCandidates,
        avgFitScore,
        statusCounts,
      },
    }) as ReactElement<ReactPDF.DocumentProps>;

    const buffer = await renderToBuffer(doc);

    const filename = `${map.name.replace(/[^a-zA-Z0-9]/g, "_")}_${variant}.pdf`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[market-map] Failed to export PDF:", error);
    return Response.json({ error: "Failed to export PDF" }, { status: 500 });
  }
}
