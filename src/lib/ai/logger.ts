import { prisma } from "@/lib/prisma";

interface AiCallInput {
  userId?: string;
  feature: string;
  metadata?: Record<string, unknown>;
}

interface AiCallResult {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
}

export async function logAiCall(input: AiCallInput, result: AiCallResult) {
  try {
    await prisma.aiCall.create({
      data: {
        userId: input.userId || null,
        feature: input.feature,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        success: result.success,
        errorMessage: result.errorMessage || null,
        metadata: (input.metadata as object) || null,
      },
    });
  } catch {
    console.error("[ai-logger] Failed to log AI call");
  }
}
