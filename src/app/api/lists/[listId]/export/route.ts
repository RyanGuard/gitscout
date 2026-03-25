import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId } = await params;

  const list = await prisma.candidateList.findUnique({
    where: { id: listId, userId: session.user.id },
    include: {
      entries: {
        include: {
          developer: {
            include: { languages: { orderBy: { percentage: "desc" }, take: 3 } },
          },
          tags: true,
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });

  if (!list) {
    return Response.json({ error: "List not found" }, { status: 404 });
  }

  // Build CSV
  const headers = [
    "Name", "Username", "Email", "Location", "Company", "Score",
    "Followers", "Stars", "Languages", "Stage", "Tags",
    "GitHub URL", "Bio",
  ];

  const rows = list.entries.map((entry) => {
    const d = entry.developer;
    return [
      d.name || "",
      d.username,
      d.email || "",
      d.location || "",
      d.company || "",
      String(d.score),
      String(d.followers),
      String(d.totalStars),
      d.languages.map((l) => l.language).join("; "),
      entry.stage,
      entry.tags.map((t) => t.tag).join("; "),
      `https://github.com/${d.username}`,
      (d.bio || "").replace(/"/g, '""'),
    ];
  });

  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${list.name.replace(/[^a-zA-Z0-9]/g, "_")}_export.csv"`,
    },
  });
}
