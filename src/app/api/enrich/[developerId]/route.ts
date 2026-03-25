import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichDeveloper } from "@/pipeline/enrichment";
import { resolveDeveloperId } from "@/lib/resolveDevId";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ developerId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { developerId: rawId } = await params;

  try {
    // Auto-index GitHub-only profiles (gh-XXXX) before enriching
    const developerId = await resolveDeveloperId(rawId);
    const contactInfo = await enrichDeveloper(developerId);
    return Response.json({ contactInfo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enrichment failed";
    console.error(`[enrich] Failed for ${rawId}: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
