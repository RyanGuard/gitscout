import { enrichPackages } from "@/lib/enrichment/packages";
import { safeErrorMessage } from "@/lib/api-error";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const primaryLanguage = searchParams.get("language");

  if (!username) {
    return Response.json({ error: "username required" }, { status: 400 });
  }

  try {
    const result = await enrichPackages(username, primaryLanguage);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: safeErrorMessage(error, "Enrichment failed") },
      { status: 500 }
    );
  }
}
