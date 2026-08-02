import { supabase } from "@/integrations/supabase/client";
import type { AttemptResult, DomainBreakdown } from "../types";

/**
 * Result summary + domain breakdown for a submitted attempt.
 * Served by a security-definer routine scoped to the attempt's owner (or an
 * admin); it returns aggregates only and never exposes the answer key.
 * In-progress and cancelled attempts return nothing.
 */
export async function getAttemptResult(attemptId: string): Promise<AttemptResult | null> {
  const { data, error } = await supabase.rpc("get_attempt_result", {
    _attempt_id: attemptId,
  });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    ...row,
    percentage: Number(row.percentage ?? 0),
    domains: (row.domains ?? []) as unknown as DomainBreakdown[],
  } as AttemptResult;
}