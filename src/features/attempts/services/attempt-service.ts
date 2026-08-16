import { supabase } from "@/integrations/supabase/client";
import type { AttemptMode } from "@/features/exams/types";
import type {
  Attempt,
  AttemptAnswer,
  AttemptCaseStudy,
  AttemptSummary,
  CaseStudyExhibit,
  ExamOption,
  ExamQuestionView,
  AttemptWithExam,
  StatementResponse,
} from "../types";

export type StartAttemptOptions = {
  /** Practice-style modes may request a shorter set than the blueprint default. */
  questionCount?: number;
  /** Skill-area practice restricts selection to one domain. */
  domainId?: string;
};

/**
 * Attempts are created exclusively by the protected `start_attempt` routine:
 * it verifies the exam is published, validates the mode, applies the exam
 * blueprint (domain allocation, non-repetition and cooldown), freezes the
 * question set, stamps `started_at` and derives `expires_at` from the server
 * clock. The browser cannot choose its own deadline, question set, exam or
 * owner — direct inserts into `attempts` are not granted to signed-in users.
 *
 * Nothing is created until this is called, which is why the start screen can
 * show the full instructions without any timer running.
 */
export async function startAttempt(
  examId: string,
  mode: AttemptMode,
  options: StartAttemptOptions = {},
): Promise<Attempt> {
  const { data, error } = await supabase.rpc("start_attempt", {
    _exam_id: examId,
    _mode: mode,
    ...(options.questionCount ? { _question_count: options.questionCount } : {}),
    ...(options.domainId ? { _domain_id: options.domainId } : {}),
  });
  if (error) throw error;
  return data as unknown as Attempt;
}

/**
 * The student's still-running attempt for this exam, if any. The start screen
 * offers to resume it instead of starting a second one, and the server refuses
 * duplicate active attempts regardless.
 */
export async function getActiveAttempt(examId: string): Promise<Attempt | null> {
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("exam_id", examId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
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
 * Served by a security-definer function that never selects `is_correct`,
 * the explanation or the pilot flag, so neither answer-key data nor
 * scored/unscored status reaches the browser during the exam.
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
    case_study_id: row.case_study_id ?? null,
    options: ((row.options ?? []) as unknown as ExamOption[]).slice().sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));
}

/**
 * Case-study narratives referenced by this attempt's questions. Scoped by the
 * database to the attempt's owner. Narrative text and exhibits only.
 */
export async function getAttemptCaseStudies(attemptId: string): Promise<AttemptCaseStudy[]> {
  const { data, error } = await supabase.rpc("get_attempt_case_studies", {
    _attempt_id: attemptId,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    organization_overview: row.organization_overview ?? null,
    existing_environment: row.existing_environment ?? null,
    business_requirements: row.business_requirements ?? null,
    technical_requirements: row.technical_requirements ?? null,
    security_requirements: row.security_requirements ?? null,
    constraints: row.constraints ?? null,
    exhibits: Array.isArray(row.exhibits) ? (row.exhibits as unknown as CaseStudyExhibit[]) : [],
    question_ids: row.question_ids ?? [],
  }));
}

export async function listAttemptAnswers(attemptId: string): Promise<AttemptAnswer[]> {
  // Grading columns (is_correct, earned_points) are intentionally excluded: they are
  // only available after submission via the gated review/result RPCs.
  const { data, error } = await supabase
    .from("attempt_answers")
    .select("id, attempt_id, question_id, selected_option_ids, answered_at, marked_for_review, statement_responses")
    .eq("attempt_id", attemptId);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, is_correct: null, earned_points: null })) as AttemptAnswer[];
}

export async function saveAnswer(params: {
  attemptId: string;
  questionId: string;
  selected: string[];
  markedForReview: boolean;
  /** Yes/No questions only. Presentation state; never graded. */
  statementResponses?: Record<string, StatementResponse>;
}): Promise<void> {
  const { error } = await supabase.from("attempt_answers").upsert(
    {
      attempt_id: params.attemptId,
      question_id: params.questionId,
      selected_option_ids: params.selected,
      marked_for_review: params.markedForReview,
      statement_responses: params.statementResponses ?? {},
      answered_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,question_id" },
  );
  if (error) throw error;
}

/**
 * Submission and scoring run entirely inside the protected `submit_attempt`
 * routine: it confirms ownership, confirms the attempt is still in progress,
 * grades every answer against the server-held key (applying the blueprint's
 * partial-credit policy and excluding pilot items), stores the submission time
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
