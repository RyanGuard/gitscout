import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichDeveloper } from "@/pipeline/enrichment";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ developerId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { developerId } = await params;

  try {
    const contactInfo = await enrichDeveloper(developerId);
    return Response.json({ contactInfo });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Enrichment failed";
    console.error(`[enrich] Failed for ${developerId}: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
