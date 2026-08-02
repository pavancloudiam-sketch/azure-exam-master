import { generateText } from "ai";

import { createLovableAiGatewayProvider, readGatewayKey } from "@/lib/ai-gateway.server";
import { AI_CONVERSATION_LIMITS, AI_DISCLAIMER, AI_MODEL } from "../constants";
import { AiError, type AiRequest, type AiResult } from "../types";
import { recordAiUsage } from "./ai-guards.server";

/**
 * The single AI service boundary.
 *
 * Nothing outside this module talks to a model provider, and this module never
 * touches exam scoring or attempt state — it only reads what a caller has
 * already been authorised to see. Callers must run the guards in
 * `ai-guards.server.ts` before invoking it.
 */
export async function runAiRequest(request: AiRequest, userId: string): Promise<AiResult> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const gateway = createLovableAiGatewayProvider(readGatewayKey());
    const result = await generateText({
      model: gateway(AI_MODEL),
      system: request.system,
      messages: request.messages.filter((message) => message.role !== "system"),
      maxOutputTokens: AI_CONVERSATION_LIMITS.maxOutputTokens,
    });

    await recordAiUsage({
      userId,
      feature: request.feature,
      model: AI_MODEL,
      status: "ok",
      requestId,
      latencyMs: Date.now() - startedAt,
      ...(request.attemptId ? { attemptId: request.attemptId } : {}),
      ...(request.metadata ? { metadata: request.metadata } : {}),
      ...(result.usage.inputTokens ? { promptTokens: result.usage.inputTokens } : {}),
      ...(result.usage.outputTokens ? { completionTokens: result.usage.outputTokens } : {}),
      ...(result.usage.totalTokens ? { totalTokens: result.usage.totalTokens } : {}),
    });

    return {
      text: result.text,
      feature: request.feature,
      model: AI_MODEL,
      requestId,
      disclaimer: AI_DISCLAIMER,
    };
  } catch (cause) {
    const status =
      (cause as { statusCode?: number; status?: number })?.statusCode ??
      (cause as { status?: number })?.status;
    const code =
      status === 429 ? "ai_rate_limited" : status === 402 ? "ai_quota_exhausted" : "ai_unavailable";

    await recordAiUsage({
      userId,
      feature: request.feature,
      model: AI_MODEL,
      status: "error",
      requestId,
      latencyMs: Date.now() - startedAt,
      errorCode: code,
      ...(request.attemptId ? { attemptId: request.attemptId } : {}),
    });

    // Provider detail is logged, never surfaced.
    console.error(
      JSON.stringify({
        severity: "error",
        code: "ai.request_failed",
        feature: request.feature,
        request_id: requestId,
        http_status: status ?? null,
      }),
    );

    if (code === "ai_rate_limited") {
      throw new AiError(code, "AskMe AI is busy right now. Please try again in a minute.");
    }
    if (code === "ai_quota_exhausted") {
      throw new AiError(code, "AskMe AI is temporarily unavailable. Please contact support.");
    }
    throw new AiError("ai_unavailable", "AskMe AI couldn't complete that request.");
  }
}
