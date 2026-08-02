import { supabase } from "@/integrations/supabase/client";

import { APP_NAME, APP_TAGLINE, APP_VERSION, FOOTER_DISCLAIMER, SUPPORT_EMAIL } from "../constants";
import type { ApplicationSettingsInput } from "../validation/settings-schemas";

export type ApplicationSettings = ApplicationSettingsInput & {
  updated_at: string | null;
};

/** Compile-time defaults used whenever the settings row cannot be read. */
export const FALLBACK_SETTINGS: ApplicationSettings = {
  application_name: APP_NAME,
  tagline: APP_TAGLINE,
  support_email: SUPPORT_EMAIL,
  footer_disclaimer: FOOTER_DISCLAIMER,
  application_version: APP_VERSION,
  default_passing_scaled_score: 700,
  default_exam_duration_minutes: 60,
  updated_at: null,
};

const COLUMNS =
  "application_name, tagline, support_email, footer_disclaimer, application_version, default_passing_scaled_score, default_exam_duration_minutes, updated_at";

/**
 * Reads the singleton settings row. The table holds no secrets and is readable
 * by everyone, so this never fails a public page: on any error the compiled
 * fallback values are returned instead.
 */
export async function fetchApplicationSettings(): Promise<ApplicationSettings> {
  try {
    const { data, error } = await supabase
      .from("application_settings")
      .select(COLUMNS)
      .eq("id", "global")
      .maybeSingle();
    if (error || !data) return FALLBACK_SETTINGS;
    return { ...FALLBACK_SETTINGS, ...data } as ApplicationSettings;
  } catch {
    return FALLBACK_SETTINGS;
  }
}

/**
 * Updates the settings row. Authorization is enforced by RLS (admins only) and
 * the database trigger writes the audit entry, so no client-side audit call is
 * needed and none can be skipped.
 */
export async function updateApplicationSettings(
  input: ApplicationSettingsInput,
): Promise<ApplicationSettings> {
  const { data, error } = await supabase
    .from("application_settings")
    .update(input)
    .eq("id", "global")
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as ApplicationSettings;
}
