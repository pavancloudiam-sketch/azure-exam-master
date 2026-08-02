import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { AiError } from "../types";

type UserClient = SupabaseClient<Database>;

export type CoachOption = {
  id: string;
  label: string | null;
  content: string;
  isCorrect: boolean;
  wasSelected: boolean;
};

export type CoachQuestionContext = {
  questionId: string;
  stem: string;
  scenario: string | null;
  questionType: string;
  topic: string | null;
  domain: string | null;
  storedExplanation: string | null;
  wasCorrect: boolean | null;
  answered: boolean;
  options: CoachOption[];
};

export type CoachAttemptContext = {
  attemptId: string;
  examTitle: string;
  weakDomains: { name: string; correct: number; total: number }[];
  question: CoachQuestionContext | null;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Builds the authoritative context handed to the coach prompt.
 *
 * Ownership and submitted status are verified by the caller through the
 * student's own RLS-scoped client BEFORE this runs; the privileged client is
 * used only to read the answer key for that one already-authorised attempt.
 */
export async function buildCoachContext(
  supabase: UserClient,
  attemptId: string,
  questionId: string | undefined,
): Promise<CoachAttemptContext> {
  const db = await admin();

  const { data: attempt } = await db
    .from("attempts")
    .select("id, exam_id, exams(title)")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attempt) throw new AiError("ai_forbidden", "That attempt isn't available to you");

  // Domain breakdown comes from the same routine the result page uses, read
  // through the student's own client so the database re-checks ownership.
  const { data: resultRows } = await supabase.rpc("get_attempt_result", {
    _attempt_id: attemptId,
  });
  const domains = ((resultRows ?? [])[0]?.domains ?? []) as unknown as {
    name: string;
    correct: number;
    total: number;
  }[];
  const weakDomains = domains
    .slice()
    .sort((a, b) => a.correct / Math.max(a.total, 1) - b.correct / Math.max(b.total, 1))
    .slice(0, 3);

  let question: CoachQuestionContext | null = null;

  if (questionId) {
    // The question must belong to this attempt's exam — a student cannot point
    // the coach at an arbitrary question id from the wider bank.
    const { data: link } = await db
      .from("exam_questions")
      .select("question_id")
      .eq("exam_id", attempt.exam_id)
      .eq("question_id", questionId)
      .maybeSingle();
    if (!link) throw new AiError("ai_forbidden", "That question isn't part of this attempt");

    const { data: row } = await db
      .from("questions")
      .select(
        "id, stem, scenario, question_type, explanation, topics(name, domains(name)), question_options(id, label, content, is_correct, sort_order)",
      )
      .eq("id", questionId)
      .maybeSingle();
    if (!row) throw new AiError("ai_invalid_request", "That question no longer exists");

    const { data: answer } = await db
      .from("attempt_answers")
      .select("selected_option_ids, is_correct")
      .eq("attempt_id", attemptId)
      .eq("question_id", questionId)
      .maybeSingle();

    const selected = new Set(answer?.selected_option_ids ?? []);
    const topic = row.topics as unknown as { name: string; domains?: { name: string } } | null;

    question = {
      questionId: row.id,
      stem: row.stem,
      scenario: row.scenario,
      questionType: row.question_type,
      topic: topic?.name ?? null,
      domain: topic?.domains?.name ?? null,
      storedExplanation: row.explanation,
      wasCorrect: answer?.is_correct ?? null,
      answered: Boolean(answer),
      options: (row.question_options ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((option) => ({
          id: option.id,
          label: option.label,
          content: option.content,
          isCorrect: option.is_correct,
          wasSelected: selected.has(option.id),
        })),
    };
  }

  return {
    attemptId,
    examTitle: (attempt.exams as unknown as { title: string } | null)?.title ?? "this exam",
    weakDomains,
    question,
  };
}

/** Renders the context as prompt text. Contains no personal identifiers. */
export function renderCoachContext(context: CoachAttemptContext): string {
  const lines: string[] = [`Exam: ${context.examTitle}`];

  if (context.weakDomains.length > 0) {
    lines.push(
      "Weakest domains in this submitted attempt: " +
        context.weakDomains.map((d) => `${d.name} (${d.correct}/${d.total})`).join("; "),
    );
  }

  const question = context.question;
  if (question) {
    lines.push(
      "---",
      `Question type: ${question.questionType}`,
      question.domain ? `Domain: ${question.domain}` : "",
      question.topic ? `Topic: ${question.topic}` : "",
      question.scenario ? `Scenario: ${question.scenario}` : "",
      `Question: ${question.stem}`,
      "Options:",
      ...question.options.map(
        (option) =>
          `- ${option.label ?? "?"}. ${option.content} [${option.isCorrect ? "CORRECT" : "incorrect"}]${
            option.wasSelected ? " [student selected this]" : ""
          }`,
      ),
      question.answered
        ? `The student's answer was ${question.wasCorrect ? "correct" : "incorrect"}.`
        : "The student left this question unanswered.",
      question.storedExplanation
        ? `Stored explanation (platform-authored, quote it verbatim when you reference it): ${question.storedExplanation}`
        : "There is no stored explanation for this question.",
    );
  }

  return lines.filter(Boolean).join("\n");
}