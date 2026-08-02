import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(120, "Name must be less than 120 characters");

const description = z
  .string()
  .trim()
  .max(600, "Description must be less than 600 characters")
  .optional()
  .or(z.literal(""));

const sortOrder = z.coerce
  .number()
  .int("Sort order must be a whole number")
  .min(0, "Sort order cannot be negative")
  .max(999, "Sort order must be 999 or less");

const optionalDate = z
  .string()
  .trim()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use the format YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

const examCode = z
  .string()
  .trim()
  .max(40, "Exam code must be less than 40 characters")
  .optional()
  .or(z.literal(""));

const versionLabel = z
  .string()
  .trim()
  .min(1, "Version is required")
  .max(20, "Version must be less than 20 characters");

const yesNo = z.enum(["yes", "no"]);

export const certificationSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(40, "Code must be less than 40 characters")
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only"),
  name,
  description,
  provider: z
    .string()
    .trim()
    .min(2, "Provider must be at least 2 characters")
    .max(80, "Provider must be less than 80 characters"),
  exam_code: examCode,
  version: versionLabel,
  effective_at: optionalDate,
});

export const newVersionSchema = z.object({
  version: versionLabel,
  exam_code: examCode,
  effective_at: optionalDate,
  clone_taxonomy: yesNo,
});

export const retireVersionSchema = z.object({
  retired_at: optionalDate,
  allow_new_attempts: yesNo,
});

export const domainSchema = z.object({
  certification_id: z.string().uuid("Select a certification"),
  name,
  weight_percent: z
    .union([z.literal(""), z.coerce.number().min(0, "Minimum 0").max(100, "Maximum 100")])
    .optional(),
  sort_order: sortOrder,
});

export const topicSchema = z.object({
  domain_id: z.string().uuid("Select a domain"),
  name,
  sort_order: sortOrder,
});

export type CertificationInput = z.infer<typeof certificationSchema>;
export type NewVersionInput = z.infer<typeof newVersionSchema>;
export type RetireVersionInput = z.infer<typeof retireVersionSchema>;
export type DomainInput = z.infer<typeof domainSchema>;
export type TopicInput = z.infer<typeof topicSchema>;