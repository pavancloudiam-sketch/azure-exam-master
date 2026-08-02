import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateQuestionsSchema } from "../validation/schemas";
import type { AiGenerationResult, GeneratedQuestionDraft } from "../types";

const FEATURE = "ai_question_generator" as const;

/** Extracts the JSON object from a model reply, tolerating a code fence. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no json");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

/**
 * The AskMe AI Question Generator (administrators only).
 *
 * Guards re-run server-side on every call: feature flag -> admin role ->
 * rate limit. The browser sends taxonomy ids, enums and optional guidance —
 * never prompt text — and the guidance is sanitised and delimiter-wrapped as
 * untrusted data. Nothing here writes to the question bank: drafts are
 * returned for human review and saved separately, always unpublished.
 */
export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateQuestionsSchema.parse(input))
  .handler(async ({ data, context }): Promise<AiGenerationResult> => {
    const [guards, prompts, safety, service, types, schemas, dedupe] = await Promise.all([
      import("./ai-guards.server"),
      import("../prompts/templates"),
      import("../prompts/safety"),
      import("./ai-service.server"),
      import("../types"),
      import("../validation/schemas"),
      import("./generator-dedupe"),
    ]);

    try {
      await guards.assertFeatureEnabled(FEATURE);
      // Admin-only module: refused for students regardless of the flag state.
      await guards.assertFeatureAllowedForCaller(FEATURE, context.supabase, context.userId);
      await guards.assertWithinRateLimit(context.userId, FEATURE);

      const [certification, domain, topic] = await Promise.all([
        context.supabase
          .from("certifications")
          .select("id, name, code")
          .eq("id", data.certificationId)
          .maybeSingle(),
        context.supabase.from("domains").select("id, name").eq("id", data.domainId).maybeSingle(),
        context.supabase.from("topics").select("id, name").eq("id", data.topicId).maybeSingle(),
      ]);
      if (!certification.data || !domain.data || !topic.data) {
        throw new types.AiError("ai_invalid_request", "Choose a certification, domain and topic.");
      }

      const guidance = data.guidance
        ? safety.sanitizeStudentText(data.guidance, 600)
        : { text: "", flags: [] as string[] };

      const system = prompts.buildSystemPrompt(
        prompts.buildGeneratorInstructions({
          certification: `${certification.data.name} (${certification.data.code})`,
          domain: domain.data.name,
          topic: topic.data.name,
          count: data.count,
          difficulty: data.difficulty,
          questionType: data.questionType,
          ...(guidance.text ? { guidance: safety.wrapUntrusted(guidance.text) } : {}),
        }),
      );

      const result = await service.runAiRequest(
        {
          feature: FEATURE,
          system,
          messages: [
            {
              role: "user",
              content: `Draft ${data.count} original practice question(s) on "${topic.data.name}" and return the JSON object described in your instructions.`,
            },
          ],
          metadata: {
            certification_id: data.certificationId,
            topic_id: data.topicId,
            count: data.count,
            injection_flags: guidance.flags.join(",") || "none",
          },
        },
        context.userId,
      );

      let payload;
      try {
        payload = schemas.generatedQuestionsPayloadSchema.parse(extractJson(result.text));
      } catch {
        throw new types.AiError(
          "ai_unavailable",
          "AskMe AI returned drafts in an unexpected format. Please try again.",
        );
      }

      // Duplicate detection against the existing bank for this certification.
      const { data: existing } = await context.supabase
        .from("questions")
        .select("id, stem")
        .eq("certification_id", data.certificationId)
        .limit(2000);

      const drafts: GeneratedQuestionDraft[] = payload.questions.map((question, index) => ({
        key: `${result.requestId}-${index}`,
        stem: question.stem,
        scenario: question.scenario?.trim() ? question.scenario.trim() : null,
        questionType: question.question_type,
        difficulty: question.difficulty,
        explanation: question.explanation,
        tags: question.tags ?? [],
        options: question.options,
        duplicates: dedupe.findDuplicates(question.stem, existing ?? []),
      }));

      await recordGeneratorAudit(context.userId, {
        action: "generate",
        request_id: result.requestId,
        certification_id: data.certificationId,
        topic_id: data.topicId,
        requested: data.count,
        returned: drafts.length,
        duplicates_flagged: drafts.filter((draft) => draft.duplicates.length > 0).length,
        injection_flags: guidance.flags,
      });

      return {
        requestId: result.requestId,
        model: result.model,
        disclaimer: result.disclaimer,
        drafts,
        sanitizedInput: guidance.flags.length > 0,
      };
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

async function recordGeneratorAudit(
  userId: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "ai.question_generator.request",
      entity_type: "ai_question_generator",
      details: details as never,
    });
  } catch {
    // Auditing must never break the feature it observes.
  }
}