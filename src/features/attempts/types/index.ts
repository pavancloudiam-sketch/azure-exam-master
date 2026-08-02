import type { Tables } from "@/integrations/supabase/types";

export type Attempt = Tables<"attempts">;
export type AttemptAnswer = Tables<"attempt_answers">;

/** Columns the dashboard history table actually renders. */
export type AttemptSummary = Pick<
  Attempt,
  "id" | "exam_id" | "status" | "mode" | "started_at" | "scaled_score" | "duration_seconds"
>;

/** Option shape returned by `get_attempt_questions` — never includes `is_correct`. */
export type ExamOption = {
  id: string;
  label: string | null;
  content: string;
  sort_order: number;
};

/**
 * Question shape returned by `get_attempt_questions`. No explanation, no answer
 * key, and deliberately no pilot flag: pilot items must be indistinguishable
 * from scored items while the exam is running.
 */
export type ExamQuestionView = {
  question_id: string;
  sort_order: number;
  stem: string;
  scenario: string | null;
  question_type: string;
  points: number;
  case_study_id: string | null;
  options: ExamOption[];
};

/** Yes/No answer for a single statement inside a `yes_no` question. */
export type StatementResponse = "yes" | "no";

export type AnswerState = {
  /**
   * Option ids the student chose. For `yes_no` questions this holds exactly
   * the statements answered "Yes" — that is what the server grades.
   */
  selected: string[];
  markedForReview: boolean;
  /**
   * `yes_no` questions only. Records the explicit Yes/No the student picked per
   * statement so a reload can tell "answered No" apart from "not answered".
   * Never used for scoring.
   */
  statementResponses?: Record<string, StatementResponse>;
};

export type PaletteState =
  | "current"
  | "answered"
  | "unanswered"
  | "marked"
  | "answered-marked";

/** Attempt row joined with its exam, used by the dashboard and attempts list. */
export type AttemptWithExam = Pick<
  Attempt,
  | "id"
  | "exam_id"
  | "status"
  | "mode"
  | "started_at"
  | "submitted_at"
  | "scaled_score"
  | "percentage"
  | "passed"
  | "duration_seconds"
> & { exams: { title: string; passing_score: number } | null };

/** One exhibit attached to a case study. All fields are optional by design. */
export type CaseStudyExhibit = {
  title?: string;
  caption?: string;
  url?: string;
  content?: string;
};

/**
 * Case-study context for the current attempt, as returned by
 * `get_attempt_case_studies`. Narrative only — no answer-key data.
 */
export type AttemptCaseStudy = {
  id: string;
  title: string;
  organization_overview: string | null;
  existing_environment: string | null;
  business_requirements: string | null;
  technical_requirements: string | null;
  security_requirements: string | null;
  constraints: string | null;
  exhibits: CaseStudyExhibit[];
  question_ids: string[];
};

/** Is this question answered? Yes/No items need every statement decided. */
export function isQuestionAnswered(
  question: Pick<ExamQuestionView, "question_type" | "options">,
  answer: AnswerState | undefined,
): boolean {
  if (!answer) return false;
  if (question.question_type === "yes_no") {
    const responses = answer.statementResponses ?? {};
    return question.options.every((option) => responses[option.id] !== undefined);
  }
  return answer.selected.length > 0;
}
