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

/** Question shape returned by `get_attempt_questions` — no explanation, no answer key. */
export type ExamQuestionView = {
  question_id: string;
  sort_order: number;
  stem: string;
  scenario: string | null;
  question_type: string;
  points: number;
  options: ExamOption[];
};

export type AnswerState = {
  selected: string[];
  markedForReview: boolean;
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
