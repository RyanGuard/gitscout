import { resyncStaleDevelopers } from "@/pipeline/scheduler";
import { safeErrorMessage } from "@/lib/api-error";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await resyncStaleDevelopers();
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: safeErrorMessage(error, "Re-sync failed") }, { status: 500 });
  }
}
