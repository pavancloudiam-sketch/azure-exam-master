import { z } from "zod";

export const questionTypeEnum = z.enum([
  "single_choice",
  "multiple_choice",
  "scenario_single_choice",
  "scenario_multiple_choice",
]);

export const difficultyEnum = z.enum(["easy", "medium", "hard"]);

export const questionOptionSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().trim().min(1, "Answer option text cannot be empty").max(600),
  is_correct: z.boolean(),
});

export const questionSchema = z
  .object({
    certification_id: z.string().uuid("Select a certification"),
    domain_id: z.string().uuid("Select a domain"),
    topic_id: z.string().uuid("Select a topic"),
    question_type: questionTypeEnum,
    scenario: z.string().trim().max(4000).optional().or(z.literal("")),
    stem: z
      .string()
      .trim()
      .min(10, "Question text must be at least 10 characters")
      .max(4000, "Question text is too long"),
    explanation: z
      .string()
      .trim()
      .min(10, "Explanation is required (at least 10 characters)")
      .max(4000, "Explanation is too long"),
    difficulty: difficultyEnum,
    points: z.coerce
      .number()
      .int("Point value must be a whole number")
      .positive("Point value must be positive")
      .max(100, "Point value must be 100 or less"),
    is_active: z.boolean(),
    options: z.array(questionOptionSchema).min(2, "Add at least two answer options"),
  })
  .superRefine((value, ctx) => {
    const scenarioRequired = value.question_type.startsWith("scenario_");
    if (scenarioRequired && !value.scenario?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scenario"],
        message: "Scenario text is required for scenario-based questions",
      });
    }

    const correct = value.options.filter((option) => option.is_correct).length;
    const multiple = value.question_type.endsWith("multiple_choice");
    if (multiple && correct < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Multiple-choice questions must have at least two correct options",
      });
    }
    if (!multiple && correct !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Single-choice questions must have exactly one correct option",
      });
    }
  });

export type QuestionInput = z.infer<typeof questionSchema>;