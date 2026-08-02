import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { studyAssistantRequestSchema } from "../validation/schemas";
import type { AiStudyOverview, AiStudyReply } from "../types";

const FEATURE = "ai_study_assistant" as const;

/**
 * The AskMe AI Study Assistant.
 *
 * Guards re-run server-side on every call: feature flag -> no live attempt ->
 * rate limit. The browser sends an action key, optional study goals and the
 * transcript — never prompt or system text — and everything the student typed
 * is sanitised and wrapped as untrusted data before it reaches the model.
 * Nothing here reads or writes attempts, scoring or the question bank.
 */
export const askStudyAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => studyAssistantRequestSchema.parse(input))
  .handler(async ({ data, context }): Promise<AiStudyReply> => {
    const [{ AI_CONVERSATION_LIMITS }, guards, prompts, safety, ctx, service, types] =
      await Promise.all([
        import("../constants"),
        import("./ai-guards.server"),
        import("../prompts/templates"),
        import("../prompts/safety"),
        import("./study-context.server"),
        import("./ai-service.server"),
        import("../types"),
      ]);

    try {
      await guards.assertFeatureEnabled(FEATURE);
      await guards.assertFeatureAllowedForCaller(FEATURE, context.supabase, context.userId);
      await guards.assertNoActiveAttempt(context.supabase);
      await guards.assertWithinRateLimit(context.userId, FEATURE);

      if (data.messages.length >= AI_CONVERSATION_LIMITS.maxTurns) {
        throw new types.AiError(
          "ai_invalid_request",
          "This conversation has reached its limit. Start a new one to continue.",
        );
      }
      if (data.action === "ask" && data.messages.at(-1)?.role !== "user") {
        throw new types.AiError("ai_invalid_request", "Type a study question first.");
      }

      const sanitized = safety.sanitizeConversation(
        data.messages,
        AI_CONVERSATION_LIMITS.maxUserMessageChars,
      );
      const focus = data.goal?.focus
        ? safety.sanitizeStudentText(data.goal.focus, 200)
        : { text: "", flags: [] as string[] };
      const injectionFlags = [...new Set([...sanitized.flags, ...focus.flags])];

      const studyContext = await ctx.buildStudyContext(context.supabase, context.userId);
      const goalLines = [
        data.goal?.targetDate ? `Target exam date: ${data.goal.targetDate}` : "",
        data.goal?.hoursPerWeek ? `Study time available: ${data.goal.hoursPerWeek} hours/week` : "",
        focus.text ? `Student-stated focus (untrusted): ${safety.wrapUntrusted(focus.text)}` : "",
      ].filter(Boolean);

      const system = prompts.buildSystemPrompt(
        prompts.buildStudyInstructions(data.action),
        [ctx.renderStudyContext(studyContext), ...goalLines].join("\n"),
      );

      const messages =
        sanitized.messages.length > 0
          ? sanitized.messages
          : [{ role: "user" as const, content: prompts.STUDY_ACTION_LABELS[data.action] }];

      const result = await service.runAiRequest(
        {
          feature: FEATURE,
          system,
          messages,
          metadata: {
            action: data.action,
            attempts_used: studyContext.submittedAttempts,
            injection_flags: injectionFlags.join(",") || "none",
          },
        },
        context.userId,
      );

      // Audit trail: opaque counters only, never prompt or reply text.
      await recordStudyAudit(context.userId, {
        action: data.action,
        request_id: result.requestId,
        injection_flags: injectionFlags,
        attempts_used: studyContext.submittedAttempts,
      });

      return { ...result, action: data.action, sanitizedInput: injectionFlags.length > 0 };
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

/** Study snapshot shown next to the assistant. Student-owned data only. */
export const getStudyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiStudyOverview> => {
    const { buildStudyContext } = await import("./study-context.server");
    const study = await buildStudyContext(context.supabase, context.userId);
    return {
      submittedAttempts: study.submittedAttempts,
      answeredQuestions: study.answeredQuestions,
      averagePercentage: study.averagePercentage,
      weakDomains: study.domains.slice(0, 3),
      weakTopics: study.topics.slice(0, 5),
      recentMistakes: study.mistakes.length,
      suggestedTopics: study.uncoveredTopics.slice(0, 5),
    };
  });

async function recordStudyAudit(userId: string, details: Record<string, unknown>): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "ai.study_assistant.request",
      entity_type: "ai_study_assistant",
      details: details as never,
    });
  } catch {
    // Auditing must never break the feature it observes.
  }
}
