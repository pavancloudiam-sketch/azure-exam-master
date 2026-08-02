import { z } from "zod";

/**
 * Blueprint configuration rules. The database enforces the same bounds with
 * CHECK constraints and a publication trigger, so this layer exists purely to
 * give admins a clear, early validation message.
 */
export const blueprintDomainWeightSchema = z.object({
  domain_id: z.string().uuid("Select a skill area"),
  min_percent: z.coerce
    .number()
    .min(0, "Minimum cannot be negative")
    .max(100, "Minimum must be 100 or less"),
  max_percent: z.coerce
    .number()
    .min(0, "Maximum cannot be negative")
    .max(100, "Maximum must be 100 or less"),
});

export const blueprintSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, "Name must be at least 3 characters")
      .max(160, "Name must be less than 160 characters"),
    certification_id: z.string().uuid("Select a certification version"),
    description: z.string().trim().max(600, "Description must be less than 600 characters"),
    mode: z.string().trim().min(1, "Select a delivery mode"),
    duration_minutes: z.coerce
      .number()
      .int("Duration must be a whole number of minutes")
      .min(1, "Duration must be at least 1 minute")
      .max(600, "Duration must be 600 minutes or less")
      .nullable(),
    min_question_count: z.coerce.number().int().min(1, "Minimum must be at least 1").max(500),
    max_question_count: z.coerce.number().int().min(1, "Maximum must be at least 1").max(500),
    default_question_count: z.coerce.number().int().min(1, "Default must be at least 1").max(500),
    passing_scaled_score: z.coerce
      .number()
      .int("Passing score must be a whole number")
      .min(1, "Passing score must be at least 1")
      .max(1000, "Passing score must be 1000 or less"),
    scoring_model_version: z.string().trim().min(1, "Select a scoring model"),
    allowed_question_types: z
      .array(z.string())
      .min(1, "Allow at least one question type"),
    pilot_question_count: z.coerce.number().int().min(0).max(50),
    case_study_count: z.coerce.number().int().min(0).max(20),
    allow_partial_credit: z.boolean(),
    randomize_questions: z.boolean(),
    randomize_options: z.boolean(),
    allow_repeats: z.boolean(),
    repetition_cooldown_days: z.coerce.number().int().min(0).max(365),
    max_repeat_count: z.coerce.number().int().min(0).max(20),
    allow_case_study_return: z.boolean(),
    domains: z.array(blueprintDomainWeightSchema),
  })
  .refine((v) => v.max_question_count >= v.min_question_count, {
    message: "Maximum question count must be at least the minimum",
    path: ["max_question_count"],
  })
  .refine(
    (v) =>
      v.default_question_count >= v.min_question_count &&
      v.default_question_count <= v.max_question_count,
    {
      message: "Default question count must sit between the minimum and maximum",
      path: ["default_question_count"],
    },
  )
  .refine((v) => v.pilot_question_count < v.default_question_count, {
    message: "Pilot items must be fewer than the default question count",
    path: ["pilot_question_count"],
  })
  .refine((v) => v.domains.every((d) => d.max_percent >= d.min_percent), {
    message: "Each skill area maximum must be at least its minimum",
    path: ["domains"],
  })
  .refine(
    (v) => v.domains.length === 0 || v.domains.reduce((sum, d) => sum + d.min_percent, 0) <= 100,
    {
      message: "Minimum percentages must not add up to more than 100%",
      path: ["domains"],
    },
  )
  .refine(
    (v) => v.domains.length === 0 || v.domains.reduce((sum, d) => sum + d.max_percent, 0) >= 100,
    {
      message: "Maximum percentages must add up to at least 100%",
      path: ["domains"],
    },
  )
  .refine(
    (v) => new Set(v.domains.map((d) => d.domain_id)).size === v.domains.length,
    { message: "Each skill area may only appear once", path: ["domains"] },
  );

export type BlueprintInput = z.infer<typeof blueprintSchema>;
