export type DomainBreakdown = {
  name: string;
  total: number;
  correct: number;
  percentage: number;
  /** Partial credit aware totals. Older attempts may not carry them. */
  earned_points?: number;
  available_points?: number;
};

export type AttemptResult = {
  attempt_id: string;
  exam_title: string;
  mode: string;
  submitted_at: string;
  duration_seconds: number;
  raw_score: number;
  max_score: number;
  percentage: number;
  scaled_score: number;
  passing_score: number;
  passed: boolean;
  total_questions: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  domains: DomainBreakdown[];
  /** Scoring model that produced the scaled score, e.g. `v1`. */
  scoring_model_version?: string;
  /** Unscored trial items included in the sitting. */
  pilot_count?: number;
  /** Items that actually counted towards the score. */
  scored_count?: number;
  earned_points?: number;
  available_points?: number;
  /** Blueprint the attempt followed, when one was applied. */
  blueprint_name?: string | null;
  blueprint_duration_minutes?: number | null;
  blueprint_snapshot?: unknown;
};

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(totalSeconds, 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
