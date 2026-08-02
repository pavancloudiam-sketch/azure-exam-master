import { supabase } from "@/integrations/supabase/client";

import type { ReviewOption, ReviewQuestion, ReviewStatus } from "../types";

/**
 * Question-by-question review of a submitted attempt.
 *
 * Authorization lives in the database: `get_attempt_review` is a
 * security-definer routine that only returns rows when the caller owns the
 * attempt (or is an admin) AND the attempt status is `submitted`. Correct
 * options and explanations are therefore never reachable from the browser for
 * an in-progress, cancelled or foreign attempt, whatever the client requests.
 */
export async function getAttemptReview(attemptId: string): Promise<ReviewQuestion[]> {
  const { data, error } = await supabase.rpc("get_attempt_review", {
    _attempt_id: attemptId,
  });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    question_id: row.question_id,
    sort_order: row.sort_order,
    stem: row.stem,
    scenario: row.scenario ?? null,
    question_type: row.question_type,
    points: row.points,
    difficulty: row.difficulty,
    domain_name: row.domain_name ?? null,
    topic_name: row.topic_name ?? null,
    explanation: row.explanation ?? null,
    marked_for_review: row.marked_for_review,
    selected_option_ids: row.selected_option_ids ?? [],
    status: row.status as ReviewStatus,
    is_pilot: row.is_pilot ?? false,
    earned_points: row.earned_points === null ? null : Number(row.earned_points),
    statement_responses: (row.statement_responses ?? {}) as Record<string, "yes" | "no">,
    case_study_id: row.case_study_id ?? null,
    case_study_title: row.case_study_title ?? null,
    options: ((row.options ?? []) as unknown as ReviewOption[]).slice().sort(
      (a, b) => a.sort_order - b.sort_order,
    ),
  }));
}
