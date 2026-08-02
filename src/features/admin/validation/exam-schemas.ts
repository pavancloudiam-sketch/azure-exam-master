import { z } from "zod";

/**
 * Exam configuration rules. The same bounds are enforced in the database by
 * CHECK constraints, so a forged client request cannot create an invalid exam.
 */
export const examSchema = z
  .object({
    certification_id: z.string().uuid("Select a certification"),
    title: z
      .string()
      .trim()
      .min(3, "Title must be at least 3 characters")
      .max(160, "Title must be less than 160 characters"),
    description: z.string().trim().max(600, "Description must be less than 600 characters"),
    instructions: z.string().trim().max(4000, "Instructions must be less than 4000 characters"),
    question_count: z.coerce
      .number()
      .int("Question count must be a whole number")
      .min(1, "Question count must be at least 1")
      .max(500, "Question count must be 500 or less"),
    passing_score: z.coerce
      .number()
      .int("Passing score must be a whole number")
      .min(1, "Passing score must be at least 1")
      .max(1000, "Passing score must be 1000 or less"),
    time_limit_minutes: z.coerce
      .number()
      .int("Duration must be a whole number of minutes")
      .min(1, "Duration must be at least 1 minute")
      .max(600, "Duration must be 600 minutes or less")
      .nullable(),
    allow_timed: z.boolean(),
    allow_practice: z.boolean(),
    is_active: z.boolean(),
  })
  .refine((value) => value.allow_timed || value.allow_practice, {
    message: "Enable at least one mode",
    path: ["allow_timed"],
  })
  .refine((value) => !value.allow_timed || value.time_limit_minutes !== null, {
    message: "Timed Mock mode needs a duration",
    path: ["time_limit_minutes"],
  });

export type ExamInput = z.infer<typeof examSchema>;