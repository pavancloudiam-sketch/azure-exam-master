import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_FEATURES, AI_RATE_LIMITS, type AiFeature } from "../constants";
import { setAiFeatureFlagSchema } from "../validation/schemas";
import type { AiFeatureFlag, AiUsageSummary } from "../types";

/** Flags are readable by any signed-in user so the UI can hide disabled modules. */
export const listAiFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiFeatureFlag[]> => {
    const { data, error } = await context.supabase
      .from("ai_feature_flags")
      .select("key, label, description, is_enabled, updated_at")
      .order("key");
    if (error) throw new Error("Could not load AI settings");
    return (data ?? []).map((row) => ({
      key: row.key as AiFeature,
      label: row.label,
      description: row.description,
      isEnabled: row.is_enabled,
      updatedAt: row.updated_at,
    }));
  });

/** Admin-only switch. RLS also enforces the admin check at the database. */
export const setAiFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => setAiFeatureFlagSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (allowed !== true) throw new Error("Not authorised");

    const { error } = await context.supabase
      .from("ai_feature_flags")
      .update({ is_enabled: data.isEnabled, updated_by: context.userId })
      .eq("key", data.key);
    if (error) throw new Error("Could not update AI settings");
    return { key: data.key, isEnabled: data.isEnabled };
  });

/** A student can see their own remaining AI budget, and nobody else's. */
export const getMyAiUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiUsageSummary[]> => {
    const { readUsageWindow } = await import("./ai-guards.server");
    return Promise.all(
      AI_FEATURES.map(async (feature) => {
        const used = await readUsageWindow(context.userId, feature);
        return {
          feature,
          usedLastHour: used.usedLastHour,
          usedToday: used.usedToday,
          perHour: AI_RATE_LIMITS[feature].perHour,
          perDay: AI_RATE_LIMITS[feature].perDay,
        };
      }),
    );
  });
