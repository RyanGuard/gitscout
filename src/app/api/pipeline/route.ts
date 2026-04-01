import { syncDevelopers } from "@/pipeline/github";
import { safeErrorMessage } from "@/lib/api-error";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.PIPELINE_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const usernames: string[] = body.usernames || [];
  const query: string = body.query || "";

  if (usernames.length === 0 && !query) {
    return Response.json(
      { error: "Provide usernames array or a search query" },
      { status: 400 }
    );
  }

  try {
    const result = await syncDevelopers({ usernames, query });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: safeErrorMessage(error, "Pipeline sync failed") }, { status: 500 });
  }
}
