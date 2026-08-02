import type { AnswerState, ExamQuestionView, PaletteState } from "@/features/attempts/types";
import type { ReviewQuestion } from "@/features/review/types";
import type { AttemptResult } from "@/features/results/types";

/** Deterministic fixtures shared by the UI tests. */

export function makeExamQuestion(overrides: Partial<ExamQuestionView> = {}): ExamQuestionView {
  return {
    question_id: "q1",
    sort_order: 1,
    stem: "Which Entra ID feature enforces MFA per application?",
    scenario: null,
    question_type: "single_choice",
    points: 1,
    options: [
      { id: "o1", label: "A", content: "Conditional Access", sort_order: 1 },
      { id: "o2", label: "B", content: "Access reviews", sort_order: 2 },
      { id: "o3", label: "C", content: "Administrative units", sort_order: 3 },
    ],
    ...overrides,
  };
}

export function makeAnswer(overrides: Partial<AnswerState> = {}): AnswerState {
  return { selected: [], markedForReview: false, ...overrides };
}

export function makeReviewQuestion(overrides: Partial<ReviewQuestion> = {}): ReviewQuestion {
  return {
    question_id: "rq1",
    sort_order: 1,
    stem: "What does Conditional Access evaluate?",
    scenario: null,
    question_type: "single_choice",
    points: 1,
    difficulty: "medium",
    domain_name: "Identity fundamentals",
    topic_name: "Conditional Access",
    explanation: "Signals such as user, device, location and risk.",
    marked_for_review: false,
    selected_option_ids: ["ro1"],
    status: "correct",
    options: [
      { id: "ro1", label: "A", content: "Signals", sort_order: 1, is_correct: true },
      { id: "ro2", label: "B", content: "Licences", sort_order: 2, is_correct: false },
    ],
    ...overrides,
  };
}

export function makeAttemptResult(overrides: Partial<AttemptResult> = {}): AttemptResult {
  return {
    attempt_id: "a1",
    exam_title: "SC-300 Practice Exam",
    mode: "timed",
    submitted_at: "2026-02-01T10:00:00.000Z",
    duration_seconds: 3725,
    raw_score: 42,
    max_score: 60,
    percentage: 70,
    scaled_score: 720,
    passing_score: 700,
    passed: true,
    total_questions: 60,
    correct_count: 42,
    incorrect_count: 15,
    unanswered_count: 3,
    domains: [
      { name: "Identity fundamentals", total: 20, correct: 16, percentage: 80 },
      { name: "Access management", total: 40, correct: 26, percentage: 65 },
    ],
    ...overrides,
  };
}

export const PALETTE_SAMPLE: PaletteState[] = [
  "current",
  "answered",
  "unanswered",
  "marked",
  "answered-marked",
];
