import type { Json, Tables } from "@/integrations/supabase/types";

export type Exam = Tables<"exams">;
export type ExamBlueprint = Tables<"exam_blueprints">;
export type ExamBlueprintDomain = Tables<"exam_blueprint_domains">;

/**
 * Attempt modes. `timed` and `practice` are the original two modes and are
 * kept so historical attempts keep rendering; the blueprint-driven modes below
 * are the ones offered on the start screen.
 */
export type AttemptMode =
  | "timed"
  | "practice"
  | "realistic_mock"
  | "domain_practice"
  | "revision";

export const ATTEMPT_MODE_LABELS: Record<AttemptMode, string> = {
  timed: "Timed",
  practice: "Practice",
  realistic_mock: "Realistic mock exam",
  domain_practice: "Skill-area practice",
  revision: "Revision",
};

export const ATTEMPT_MODE_DESCRIPTIONS: Record<AttemptMode, string> = {
  timed: "Timed run against the clock.",
  practice: "Untimed run with no clock.",
  realistic_mock:
    "Full-length, timed, blueprint-weighted sitting. The closest experience to a real exam day.",
  domain_practice: "A shorter untimed set drawn from one skill area you choose.",
  revision:
    "An untimed set that favours questions you previously answered incorrectly or left blank.",
};

/** Plain-language rules shown next to every mode, in the catalogue and gate. */
export type AttemptModeRules = {
  timer: string;
  questions: string;
  explanations: string;
  repeats: string;
  domainFilter: string;
};

export const ATTEMPT_MODE_RULES: Record<AttemptMode, AttemptModeRules> = {
  timed: {
    timer: "Countdown runs; the attempt submits itself when time runs out.",
    questions: "The exam's configured question count.",
    explanations: "Explanations appear only after you submit.",
    repeats: "Questions you have seen recently may be reused.",
    domainFilter: "Covers every skill area.",
  },
  practice: {
    timer: "No timer. Take as long as you need.",
    questions: "The exam's configured question count.",
    explanations: "Explanations appear only after you submit.",
    repeats: "Questions you have seen recently may be reused.",
    domainFilter: "Covers every skill area.",
  },
  realistic_mock: {
    timer: "Countdown runs; the attempt submits itself when time runs out.",
    questions: "Full blueprint length, weighted across every skill area.",
    explanations: "Explanations appear only after you submit.",
    repeats: "Recently seen questions are avoided while the cooldown lasts.",
    domainFilter: "Weighted across every skill area in the official ranges.",
  },
  domain_practice: {
    timer: "No timer. Take as long as you need.",
    questions: "A shorter set you choose, drawn from a single skill area.",
    explanations: "Explanations appear only after you submit.",
    repeats: "Recently seen questions are avoided where the pool allows.",
    domainFilter: "You pick one skill area.",
  },
  revision: {
    timer: "No timer. Take as long as you need.",
    questions: "A shorter set you choose.",
    explanations: "Explanations appear only after you submit.",
    repeats: "Deliberately reuses questions you got wrong or left blank.",
    domainFilter: "Covers every skill area you have already attempted.",
  },
};

/** Modes a student can pick, in display order. */
export const SELECTABLE_ATTEMPT_MODES: AttemptMode[] = [
  "realistic_mock",
  "practice",
  "domain_practice",
  "revision",
];

export function isSelectableMode(value: string): value is AttemptMode {
  return (SELECTABLE_ATTEMPT_MODES as string[]).includes(value);
}

/** Modes that run against a countdown. */
export function isTimedMode(mode: string): boolean {
  return mode === "timed" || mode === "realistic_mock";
}

/** Modes where the student chooses how many questions to answer. */
export function allowsCustomQuestionCount(mode: AttemptMode): boolean {
  return mode === "domain_practice" || mode === "revision" || mode === "practice";
}

/** A skill area with its blueprint weighting, used on the start screen. */
export type BlueprintDomainView = {
  domain_id: string;
  name: string;
  min_percent: number;
  max_percent: number;
  sort_order: number;
  topic_quotas: Json;
};

export type BlueprintView = ExamBlueprint & { domains: BlueprintDomainView[] };

/** Human labels for the question types a blueprint may allow. */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  scenario_single_choice: "Scenario, single choice",
  scenario_multiple_choice: "Scenario, multiple choice",
  yes_no: "Yes/No statement set",
};

export function questionTypeLabel(value: string): string {
  return QUESTION_TYPE_LABELS[value] ?? value.replace(/_/g, " ");
}
