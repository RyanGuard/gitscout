import { resyncStaleDevelopers } from "@/pipeline/scheduler";

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
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[cron] Re-sync failed: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }
}
