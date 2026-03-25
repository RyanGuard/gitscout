import { NextResponse } from "next/server";
import { parseJobDescription } from "@/lib/jd-parser";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' field" },
        { status: 400 }
      );
    }

    const requirements = parseJobDescription(text);
    return NextResponse.json(requirements);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse job description" },
      { status: 500 }
    );
  }
}
