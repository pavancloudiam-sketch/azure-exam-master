import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { ADMIN_ONLY_FEATURES, AI_RATE_LIMITS, type AiFeature } from "../constants";
import { AiError } from "../types";

type UserClient = SupabaseClient<Database>;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Throws unless the module is switched on in ai_feature_flags. */
export async function assertFeatureEnabled(feature: AiFeature): Promise<void> {
  const db = await admin();
  const { data, error } = await db
    .from("ai_feature_flags")
    .select("is_enabled")
    .eq("key", feature)
    .maybeSingle();
  if (error) throw new AiError("ai_unavailable", "AI service is unavailable");
  if (!data?.is_enabled) {
    throw new AiError("ai_disabled", "This AskMe AI feature is not enabled yet");
  }
}

export async function isAdmin(supabase: UserClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) return false;
  return data === true;
}

/** Admin-only modules are refused for students regardless of the flag state. */
export async function assertFeatureAllowedForCaller(
  feature: AiFeature,
  supabase: UserClient,
  userId: string,
): Promise<void> {
  if (!ADMIN_ONLY_FEATURES.includes(feature)) return;
  if (!(await isAdmin(supabase, userId))) {
    throw new AiError("ai_forbidden", "You don't have access to this AskMe AI feature");
  }
}

/**
 * Student data-access rule for attempt-scoped AI.
 *
 * Reads through the caller's own RLS-scoped client, so ownership is enforced
 * by the database, and additionally requires a submitted status: AI may never
 * touch an attempt that is still in progress or cancelled.
 */
export async function assertSubmittedAttemptOwnedBy(
  supabase: UserClient,
  attemptId: string,
): Promise<{ attemptId: string; examId: string }> {
  const { data, error } = await supabase
    .from("attempts")
    .select("id, exam_id, status")
    .eq("id", attemptId)
    .maybeSingle();
  if (error || !data) {
    throw new AiError("ai_forbidden", "That attempt isn't available to you");
  }
  if (data.status !== "submitted") {
    throw new AiError(
      "ai_forbidden",
      "AskMe AI can only discuss an exam after you have submitted it",
    );
  }
  return { attemptId: data.id, examId: data.exam_id };
}

/** Refuses AI work while the student has any live attempt open. */
export async function assertNoActiveAttempt(supabase: UserClient): Promise<void> {
  const { count, error } = await supabase
    .from("attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_progress");
  if (error) return;
  if ((count ?? 0) > 0) {
    throw new AiError(
      "ai_forbidden",
      "AskMe AI is paused while you have an exam in progress. Submit or cancel it first.",
    );
  }
}

export type RateWindow = { usedLastHour: number; usedToday: number };

export async function readUsageWindow(userId: string, feature: AiFeature): Promise<RateWindow> {
  const db = await admin();
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [hour, day] = await Promise.all([
    db
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", feature)
      .gte("created_at", hourAgo),
    db
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("feature", feature)
      .gte("created_at", dayAgo),
  ]);

  return { usedLastHour: hour.count ?? 0, usedToday: day.count ?? 0 };
}

/** Rate protection. Counts real requests, so retries and refreshes count too. */
export async function assertWithinRateLimit(userId: string, feature: AiFeature): Promise<void> {
  const limits = AI_RATE_LIMITS[feature];
  const used = await readUsageWindow(userId, feature);
  if (used.usedLastHour >= limits.perHour || used.usedToday >= limits.perDay) {
    throw new AiError(
      "ai_rate_limited",
      "You've reached the AskMe AI usage limit for now. Try again later.",
    );
  }
}

/** Usage logging. Opaque identifiers and counters only — never prompt text. */
export async function recordAiUsage(entry: {
  userId: string;
  feature: AiFeature;
  model: string;
  status: "ok" | "error";
  requestId: string;
  latencyMs: number;
  errorCode?: string;
  attemptId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  metadata?: Record<string, string | number | boolean>;
}): Promise<void> {
  try {
    const db = await admin();
    await db.from("ai_usage_logs").insert({
      user_id: entry.userId,
      feature: entry.feature,
      model: entry.model,
      status: entry.status,
      error_code: entry.errorCode ?? null,
      request_id: entry.requestId,
      latency_ms: entry.latencyMs,
      attempt_id: entry.attemptId ?? null,
      prompt_tokens: entry.promptTokens ?? null,
      completion_tokens: entry.completionTokens ?? null,
      total_tokens: entry.totalTokens ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch {
    // Usage logging must never break the feature it observes.
  }
}
