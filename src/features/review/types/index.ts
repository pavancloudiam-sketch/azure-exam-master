export type ReviewStatus = "correct" | "partial" | "incorrect" | "unanswered";

export type ReviewOption = {
  id: string;
  label: string;
  content: string;
  sort_order: number;
  is_correct: boolean;
};

/** One question of a submitted attempt, as returned by `get_attempt_review`. */
export type ReviewQuestion = {
  question_id: string;
  sort_order: number;
  stem: string;
  scenario: string | null;
  question_type: string;
  points: number;
  difficulty: string;
  domain_name: string | null;
  topic_name: string | null;
  explanation: string | null;
  marked_for_review: boolean;
  selected_option_ids: string[];
  status: ReviewStatus;
  options: ReviewOption[];
  /** Unscored trial item. Shown after submission only, never during the exam. */
  is_pilot?: boolean;
  /** Points actually credited, so partial credit is visible. */
  earned_points?: number | null;
  /** `yes_no` items: the Yes/No the student recorded per statement. */
  statement_responses?: Record<string, "yes" | "no">;
  case_study_id?: string | null;
  case_study_title?: string | null;
};

export type ReviewFilter = "all" | "correct" | "incorrect" | "unanswered" | "marked";

export const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  all: "All",
  correct: "Correct",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
  marked: "Marked for review",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  correct: "Correct",
  partial: "Partially correct",
  incorrect: "Incorrect",
  unanswered: "Unanswered",
};
