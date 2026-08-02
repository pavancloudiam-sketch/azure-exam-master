import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { aiCoachRequestSchema, aiReportContentSchema } from "../validation/schemas";
import type { AiCoachReply } from "../types";

/**
 * The post-exam AskMe AI Coach.
 *
 * Every request re-runs the safety chain server-side: feature flag ->
 * submitted + owned attempt -> no live attempt open -> rate limit. The client
 * supplies ids and an action key only; prompts are built here.
 */
export const askAiCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => aiCoachRequestSchema.parse(input))
  .handler(async ({ data, context }): Promise<AiCoachReply> => {
    const [{ AI_CONVERSATION_LIMITS }, guards, prompts, ctx, service, types] = await Promise.all([
      import("../constants"),
      import("./ai-guards.server"),
      import("../prompts/templates"),
      import("./coach-context.server"),
      import("./ai-service.server"),
      import("../types"),
    ]);

    try {
      await guards.assertFeatureEnabled("ai_coach");
      await guards.assertFeatureAllowedForCaller("ai_coach", context.supabase, context.userId);
      await guards.assertNoActiveAttempt(context.supabase);
      await guards.assertSubmittedAttemptOwnedBy(context.supabase, data.attemptId);
      await guards.assertWithinRateLimit(context.userId, "ai_coach");

      if (data.messages.length >= AI_CONVERSATION_LIMITS.maxTurns) {
        throw new types.AiError(
          "ai_invalid_request",
          "This conversation has reached its limit. Start a new one to continue.",
        );
      }
      if (data.action === "ask" && data.messages.at(-1)?.role !== "user") {
        throw new types.AiError("ai_invalid_request", "Type a question first.");
      }
      if (
        (data.action === "explain" || data.action === "simplify" || data.action === "real_world") &&
        !data.questionId
      ) {
        throw new types.AiError("ai_invalid_request", "Choose a question first.");
      }

      const coachContext = await ctx.buildCoachContext(
        context.supabase,
        data.attemptId,
        data.questionId,
      );

      const system = prompts.buildSystemPrompt(
        [
          prompts.PROMPT_TEMPLATES.ai_coach,
          prompts.COACH_ACTION_INSTRUCTIONS[data.action],
        ].join("\n\n"),
        ctx.renderCoachContext(coachContext),
      );

      const messages =
        data.messages.length > 0
          ? data.messages
          : [{ role: "user" as const, content: prompts.COACH_ACTION_LABELS[data.action] }];

      const result = await service.runAiRequest(
        {
          feature: "ai_coach",
          system,
          messages,
          attemptId: data.attemptId,
          metadata: {
            action: data.action,
            ...(data.questionId ? { question_id: data.questionId } : {}),
          },
        },
        context.userId,
      );

      return { ...result, action: data.action };
    } catch (cause) {
      if (cause instanceof types.AiError) {
        throw new Error(JSON.stringify({ aiErrorCode: cause.code, message: cause.message }));
      }
      throw new Error(
        JSON.stringify({
          aiErrorCode: "ai_unavailable",
          message: "AskMe AI couldn't complete that request. Please try again.",
        }),
      );
    }
  });

/** Report unsafe or inaccurate AI output. Stored under the reporter's own id. */
export const reportAiContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => aiReportContentSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_content_reports").insert({
      user_id: context.userId,
      feature: data.feature,
      attempt_id: data.attemptId ?? null,
      question_id: data.questionId ?? null,
      request_id: data.requestId ?? null,
      reason: data.reason,
      note: data.note ?? null,
      reported_text: data.reportedText.slice(0, 8000),
    });
    if (error) throw new Error("Could not submit that report. Please try again.");
    return { ok: true as const };
  });