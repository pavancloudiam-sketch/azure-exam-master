import { z } from "zod";

/**
 * Platform settings rules. The same bounds exist as CHECK constraints on
 * `public.application_settings`, so a forged request cannot bypass them.
 */
export const applicationSettingsSchema = z.object({
  application_name: z
    .string()
    .trim()
    .min(2, "Application name must be at least 2 characters")
    .max(80, "Application name must be 80 characters or less"),
  tagline: z
    .string()
    .trim()
    .min(2, "Tagline must be at least 2 characters")
    .max(160, "Tagline must be 160 characters or less"),
  support_email: z
    .string()
    .trim()
    .email("Enter a valid support email address")
    .max(255, "Support email must be 255 characters or less"),
  footer_disclaimer: z.string().trim().max(600, "Disclaimer must be 600 characters or less"),
  application_version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+([-.a-zA-Z0-9]*)$/, "Use a semantic version such as 0.1.0"),
  default_passing_scaled_score: z.coerce
    .number()
    .int("Passing score must be a whole number")
    .min(1, "Passing score must be at least 1")
    .max(1000, "Passing score must be 1000 or less"),
  default_exam_duration_minutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(600, "Duration must be 600 minutes or less"),
});

export type ApplicationSettingsInput = z.infer<typeof applicationSettingsSchema>;
