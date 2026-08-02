import type { Tables } from "@/integrations/supabase/types";

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
  realistic_mock: "Realistic mock",
  domain_practice: "Skill-area practice",
  revision: "Revision",
};

export const ATTEMPT_MODE_DESCRIPTIONS: Record<AttemptMode, string> = {
  timed: "Timed run against the clock.",
  practice: "Untimed run with no clock.",
  realistic_mock:
    "Full-length, timed, blueprint-weighted sitting. Closest to a real exam day.",
  domain_practice: "Shorter untimed set drawn from a single skill area.",
  revision:
    "Untimed set that favours questions you previously answered incorrectly or left blank.",
};

/** Modes a student can pick on the start screen, in display order. */
export const SELECTABLE_ATTEMPT_MODES: AttemptMode[] = [
  "realistic_mock",
  "practice",
  "domain_practice",
  "revision",
];

/** Modes that run against a countdown. */
export function isTimedMode(mode: string): boolean {
  return mode === "timed" || mode === "realistic_mock";
}

/** A skill area with its blueprint weighting, used on the start screen. */
export type BlueprintDomainView = {
  domain_id: string;
  name: string;
  min_percent: number;
  max_percent: number;
  sort_order: number;
};

export type BlueprintView = ExamBlueprint & { domains: BlueprintDomainView[] };
