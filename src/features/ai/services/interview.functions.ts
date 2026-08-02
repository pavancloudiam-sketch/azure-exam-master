import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  aiInterviewTurnSchema,
  saveInterviewSessionSchema,
} from "../validation/schemas";
import type {
  AiInterviewReply,
  AiInterviewSessionDetail,
  AiInterviewSessionSummary,
} from "../types";

const FEATURE = "ai_interview_coach" as const;

/**
 * One mock-interview turn.
 *
 * The browser sends the chosen setup plus the transcript so far — never prompt
 * or system text. Guards run server-side on every call, and nothing here reads
 * or writes exam attempts, scoring or the question bank.
 */
export const runInterviewTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => aiInterviewTurnSchema.parse(input))
  .handler(async ({ data, context }): Promise<AiInterviewReply> => {
    const [{ AI_CONVERSATION_LIMITS }, guards, prompts, service, types] = await Promise.all([
      import("../constants"),
      import("./ai-guards.server"),
      import("../prompts/templates"),
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
          "This interview has reached its length limit. Start a new one to continue.",
        );
      }

      const questionsAsked = data.messages.filter((m) => m.role === "assistant").length;
      if (questionsAsked > 0 && data.messages.at(-1)?.role !== "user") {
        throw new types.AiError("ai_invalid_request", "Answer the current question first.");
      }

      const isFinal = questionsAsked > 0 && questionsAsked >= data.setup.plannedQuestions;

      const system = prompts.buildSystemPrompt(
        prompts.buildInterviewInstructions(
          {
            topic: data.setup.topic,
            difficulty: data.setup.difficulty,
            style: data.setup.style,
            plannedQuestions: data.setup.plannedQuestions,
            questionsAsked,
          },
          isFinal,
        ),
      );

      const messages =
        data.messages.length > 0
          ? data.messages.map(({ role, content }) => ({ role, content }))
          : [{ role: "user" as const, content: "Start the interview." }];

      const result = await service.runAiRequest(
        {
          feature: FEATURE,
          system,
          messages,
          metadata: {
            difficulty: data.setup.difficulty,
            style: data.setup.style,
            planned_questions: data.setup.plannedQuestions,
            questions_asked: questionsAsked,
          },
        },
        context.userId,
      );

      return { ...result, isFinal, questionsAsked: questionsAsked + (isFinal ? 0 : 1) };
    } catch (cause) {
      if (cause instanceof types.AiError) {
        throw new Error(JSON.stringify({ aiErrorCode: cause.code, message: cause.message }));
      }
      throw new Error(
        JSON.stringify({
          aiErrorCode: "ai_unavailable",
          message: "AskMe AI couldn't continue the interview. Please try again.",
        }),
      );
    }
  });

/**
 * Saves a transcript only when the student explicitly asks for it. Written
 * through the caller's own RLS-scoped client, so it can only ever land under
 * their own user id.
 */
export const saveInterviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveInterviewSessionSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const questionsAsked = data.messages.filter((m) => m.role === "assistant").length;
    const { data: session, error } = await context.supabase
      .from("ai_interview_sessions")
      .insert({
        user_id: context.userId,
        title: data.title ?? `${data.setup.topic} interview`,
        topic: data.setup.topic,
        difficulty: data.setup.difficulty,
        style: data.setup.style,
        planned_questions: data.setup.plannedQuestions,
        questions_asked: questionsAsked,
        status: data.status,
      })
      .select("id")
      .single();
    if (error || !session) throw new Error("Could not save this interview. Please try again.");

    const { error: turnsError } = await context.supabase.from("ai_interview_turns").insert(
      data.messages.map((message, index) => ({
        session_id: session.id,
        sort_order: index,
        role: message.role,
        content: message.content,
      })),
    );
    if (turnsError) {
      await context.supabase.from("ai_interview_sessions").delete().eq("id", session.id);
      throw new Error("Could not save this interview. Please try again.");
    }

    return { id: session.id };
  });

/** A student sees only their own saved interviews. */
export const listInterviewSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiInterviewSessionSummary[]> => {
    const { data, error } = await context.supabase
      .from("ai_interview_sessions")
      .select("id, title, topic, difficulty, style, planned_questions, questions_asked, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load your saved interviews.");
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      topic: row.topic,
      difficulty: row.difficulty,
      style: row.style,
      plannedQuestions: row.planned_questions,
      questionsAsked: row.questions_asked,
      status: row.status,
      createdAt: row.created_at,
    }));
  });

export const getInterviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<AiInterviewSessionDetail> => {
    const { data: row, error } = await context.supabase
      .from("ai_interview_sessions")
      .select("id, title, topic, difficulty, style, planned_questions, questions_asked, status, created_at")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !row) throw new Error("That interview isn't available.");

    const { data: turns } = await context.supabase
      .from("ai_interview_turns")
      .select("role, content, sort_order")
      .eq("session_id", row.id)
      .order("sort_order");

    return {
      id: row.id,
      title: row.title,
      topic: row.topic,
      difficulty: row.difficulty,
      style: row.style,
      plannedQuestions: row.planned_questions,
      questionsAsked: row.questions_asked,
      status: row.status,
      createdAt: row.created_at,
      turns: (turns ?? []).map((turn) => ({
        role: turn.role as "user" | "assistant",
        content: turn.content,
      })),
    };
  });

export const deleteInterviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_interview_sessions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not delete that interview.");
    return { ok: true as const };
  });
