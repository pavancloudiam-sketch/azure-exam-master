import { supabase } from "@/integrations/supabase/client";
import type { Exam, AttemptMode } from "@/features/exams/types";
import type {
  Attempt,
  AttemptAnswer,
  AttemptSummary,
  ExamOption,
  ExamQuestionView,
  AttemptWithExam,
} from "../types";

/**
 * Attempts are created exclusively by the protected `start_attempt` routine:
 * it verifies the exam is published, validates the mode, stamps `started_at`
 * and derives `expires_at` from the server clock. The browser cannot choose
 * its own deadline, exam or owner — direct inserts into `attempts` are no
 * longer granted to signed-in users.
 */
export async function startAttempt(exam: Exam, mode: AttemptMode): Promise<Attempt> {
  const { data, error } = await supabase.rpc("start_attempt", {
    _exam_id: exam.id,
    _mode: mode,
  });
  if (error) throw error;
  return data as unknown as Attempt;
}

/**
 * Seconds left according to the server clock. Returns null for untimed
 * attempts. The countdown UI is only a display of this value.
 */
export async function getAttemptTimeRemaining(attemptId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_attempt_time_remaining", {
    _attempt_id: attemptId,
  });
  if (error) throw error;
  return data === null ? null : Number(data);
}

export async function getAttempt(attemptId: string): Promise<Attempt | null> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Attempt header for the exam runner: the attempt row and its exam title in a
 * single round trip, instead of loading the attempt and then the exam.
 */
export async function getAttemptExamTitle(attemptId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("attempts")
    .select("id, exams(title)")
    .eq("id", attemptId)
    .maybeSingle();
  if (error) throw error;
  return data?.exams?.title ?? null;
}

/**
 * Questions + options for the signed-in student's own attempt.
 * Served by a security-definer function that never selects `is_correct`
 * or the explanation, so no answer-key data reaches the browser.
 */
export async function getAttemptQuestions(attemptId: string): Promise<ExamQuestionView[]> {
  const { data, error } = await supabase.rpc("get_attempt_questions", {
    _attempt_id: attemptId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    question_id: row.question_id,
    sort_order: row.sort_order,
    stem: row.stem,
    scenario: row.scenario,
    question_type: row.question_type,
    points: row.points,
    options: ((row.options ?? []) as unknown as ExamOption[]).slice().sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));
}

export async function listAttemptAnswers(attemptId: string): Promise<AttemptAnswer[]> {
  const { data, error } = await supabase
    .from("attempt_answers")
    .select("*")
    .eq("attempt_id", attemptId);
  if (error) throw error;
  return data ?? [];
}

export async function saveAnswer(params: {
  attemptId: string;
  questionId: string;
  selected: string[];
  markedForReview: boolean;
}): Promise<void> {
  const { error } = await supabase.from("attempt_answers").upsert(
    {
      attempt_id: params.attemptId,
      question_id: params.questionId,
      selected_option_ids: params.selected,
      marked_for_review: params.markedForReview,
      answered_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,question_id" },
  );
  if (error) throw error;
}

/**
 * Submission and scoring run entirely inside the protected `submit_attempt`
 * routine: it confirms ownership, confirms the attempt is still in progress,
 * grades every answer against the server-held key, stores the submission time
 * and time taken, and locks the attempt — all in one transaction. The client
 * never sends a score or any correctness value, and a second call to an
 * already-submitted attempt returns the stored result without re-scoring.
 */
export async function submitAttempt(attemptId: string): Promise<Attempt> {
  const { data, error } = await supabase.rpc("submit_attempt", { _attempt_id: attemptId });
  if (error) throw error;
  return data as unknown as Attempt;
}

/** Abandon an in-progress attempt. Cancelled attempts never become results. */
export async function cancelAttempt(attemptId: string): Promise<Attempt> {
  const { data, error } = await supabase.rpc("cancel_attempt", { _attempt_id: attemptId });
  if (error) throw error;
  return data as unknown as Attempt;
}

/**
 * Recent attempts for the signed-in student. Only the columns the history
 * table renders are selected, and the list is capped — RLS already scopes the
 * rows to the caller, and `attempts_user_started_idx` serves the ordering.
 */
export async function listMyAttempts(limit = 20): Promise<AttemptSummary[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select("id, exam_id, status, mode, started_at, scaled_score, duration_seconds")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
/**
 * Attempts for the signed-in student with the exam title embedded. RLS scopes
 * the rows to the caller; this powers the dashboard and My attempts page.
 */
export async function listMyAttemptsDetailed(limit = 100): Promise<AttemptWithExam[]> {
  const { data, error } = await supabase
    .from("attempts")
    .select(
      "id, exam_id, status, mode, started_at, submitted_at, scaled_score, percentage, passed, duration_seconds, exams(title, passing_score)",
    )
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AttemptWithExam[];
}
