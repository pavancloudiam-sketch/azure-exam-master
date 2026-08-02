import type { Tables } from "@/integrations/supabase/types";

export type Question = Tables<"questions">;
export type QuestionOption = Tables<"question_options">;
export type Exam = Tables<"exams">;
export type ExamQuestion = Tables<"exam_questions">;

export type QuestionWithOptions = Question & { options: QuestionOption[] };

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "scenario_single_choice"
  | "scenario_multiple_choice";

export type Difficulty = "easy" | "medium" | "hard";

export type GovernanceStatus =
  | "draft"
  | "technical_review"
  | "language_review"
  | "approved";

export const GOVERNANCE_STATUS_LABELS: Record<GovernanceStatus, string> = {
  draft: "Draft",
  technical_review: "Technical review",
  language_review: "Language review",
  approved: "Approved",
};

export type QuestionStats = {
  question_id: string;
  /** Published exams currently referencing the question. */
  usage_count: number;
  /** Submitted attempts whose exam contained the question. */
  attempt_count: number;
  correct_count: number;
  /** Percentage of those attempts answered correctly, or null when unused. */
  pass_rate: number | null;
};

export type QuestionSearchParams = {
  search: string;
  certificationId: string;
  topicIds: string[] | null;
  topicId: string;
  difficulty: string;
  questionType: string;
  governanceStatus: string;
  activeStatus: "all" | "active" | "inactive" | "archived";
  tag: string;
  reviewFlag: "all" | "flagged" | "clear";
  importBatchId: string;
  page: number;
  pageSize: number;
};

export type QuestionPage = {
  rows: QuestionWithOptions[];
  total: number;
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  scenario_single_choice: "Scenario — single choice",
  scenario_multiple_choice: "Scenario — multiple choice",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function isScenarioType(type: string): boolean {
  return type.startsWith("scenario_");
}

export function isMultipleChoice(type: string): boolean {
  return type.endsWith("multiple_choice");
}