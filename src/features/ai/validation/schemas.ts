import { z } from "zod";

import {
  AI_CONVERSATION_LIMITS,
  AI_FEATURES,
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_LENGTHS,
  INTERVIEW_MAX_TITLE_CHARS,
  INTERVIEW_STYLES,
} from "../constants";
import { COACH_ACTIONS, STUDY_ACTIONS } from "../prompts/templates";

export const aiFeatureSchema = z.enum(AI_FEATURES);

export const aiMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(AI_CONVERSATION_LIMITS.maxUserMessageChars, "Message is too long"),
});

/**
 * Every AI module validates its client payload with a schema built on top of
 * this base. Free-form system prompts are never accepted from the browser.
 */
export const aiConversationSchema = z.object({
  feature: aiFeatureSchema,
  messages: z
    .array(aiMessageSchema)
    .min(1, "At least one message is required")
    .max(AI_CONVERSATION_LIMITS.maxTurns, "This conversation has reached its limit"),
});

export const setAiFeatureFlagSchema = z.object({
  key: aiFeatureSchema,
  isEnabled: z.boolean(),
});

const uuid = z.string().uuid("Invalid identifier");

/** Coach payload. Only ids and an action key — never a system prompt. */
export const aiCoachRequestSchema = z.object({
  attemptId: uuid,
  questionId: uuid.optional(),
  action: z.enum(COACH_ACTIONS),
  messages: z
    .array(aiMessageSchema)
    .max(AI_CONVERSATION_LIMITS.maxTurns, "This conversation has reached its limit")
    .default([]),
});

export const aiReportContentSchema = z.object({
  attemptId: uuid.optional(),
  questionId: uuid.optional(),
  requestId: z.string().trim().max(100).optional(),
  feature: aiFeatureSchema,
  reason: z.enum(["inaccurate", "unsafe", "reveals_exam_content", "off_topic", "other"]),
  note: z.string().trim().max(1000).optional(),
  reportedText: z.string().trim().min(1).max(8000),
});

export type AiConversationInput = z.infer<typeof aiConversationSchema>;
export type SetAiFeatureFlagInput = z.infer<typeof setAiFeatureFlagSchema>;
export type AiCoachRequestInput = z.infer<typeof aiCoachRequestSchema>;
export type AiReportContentInput = z.infer<typeof aiReportContentSchema>;

/** Interview setup chosen by the student. Free-form topic is length-capped. */
export const interviewSetupSchema = z.object({
  topic: z.string().trim().min(2, "Choose a topic").max(120, "Topic is too long"),
  difficulty: z.enum(INTERVIEW_DIFFICULTIES),
  style: z.enum(INTERVIEW_STYLES),
  plannedQuestions: z
    .number()
    .int()
    .refine(
      (value) => (INTERVIEW_LENGTHS as readonly number[]).includes(value),
      "Choose a valid interview length",
    ),
});

export const aiInterviewTurnSchema = z.object({
  setup: interviewSetupSchema,
  messages: z
    .array(aiMessageSchema)
    .max(AI_CONVERSATION_LIMITS.maxTurns, "This interview has reached its limit")
    .default([]),
});

export const saveInterviewSessionSchema = z.object({
  setup: interviewSetupSchema,
  title: z.string().trim().min(1).max(INTERVIEW_MAX_TITLE_CHARS).optional(),
  status: z.enum(["in_progress", "completed"]).default("in_progress"),
  messages: z
    .array(aiMessageSchema)
    .min(1, "There is nothing to save yet")
    .max(AI_CONVERSATION_LIMITS.maxTurns, "This interview has reached its limit"),
});

export type InterviewSetupInput = z.infer<typeof interviewSetupSchema>;
export type AiInterviewTurnInput = z.infer<typeof aiInterviewTurnSchema>;
export type SaveInterviewSessionInput = z.infer<typeof saveInterviewSessionSchema>;

/* ------------------------------------------------------------------ */
/* AI Study Assistant                                                  */
/* ------------------------------------------------------------------ */

/** Optional study-goal inputs. Free text is length-capped and sanitised server-side. */
export const studyGoalSchema = z.object({
  targetDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
    .optional(),
  hoursPerWeek: z.number().int().min(1).max(60).optional(),
  focus: z.string().trim().max(200, "Focus is too long").optional(),
});

/** Study Assistant payload. Only an action key, goals and the transcript. */
export const studyAssistantRequestSchema = z.object({
  action: z.enum(STUDY_ACTIONS),
  goal: studyGoalSchema.optional(),
  messages: z
    .array(aiMessageSchema)
    .max(AI_CONVERSATION_LIMITS.maxTurns, "This conversation has reached its limit")
    .default([]),
});

export type StudyGoalInput = z.infer<typeof studyGoalSchema>;
export type StudyAssistantRequestInput = z.infer<typeof studyAssistantRequestSchema>;

/* ------------------------------------------------------------------ */
/* AI Question Generator (admin only)                                  */
/* ------------------------------------------------------------------ */

export const generatorDifficultySchema = z.enum(["easy", "medium", "hard", "mixed"]);
export const generatorQuestionTypeSchema = z.enum([
  "single_choice",
  "multiple_choice",
  "scenario_single_choice",
  "scenario_multiple_choice",
  "mixed",
]);

/** Admin generation request. Only ids, enums and length-capped guidance. */
export const generateQuestionsSchema = z.object({
  certificationId: uuid,
  domainId: uuid,
  topicId: uuid,
  count: z.number().int().min(1, "Generate at least one question").max(5, "Generate at most five at a time"),
  difficulty: generatorDifficultySchema,
  questionType: generatorQuestionTypeSchema,
  guidance: z.string().trim().max(600, "Guidance is too long").optional(),
});

/** Shape the model must return. Parsed and rejected server-side when invalid. */
export const generatedQuestionSchema = z.object({
  stem: z.string().trim().min(10).max(4000),
  scenario: z.string().trim().max(4000).nullable().optional(),
  question_type: z.enum([
    "single_choice",
    "multiple_choice",
    "scenario_single_choice",
    "scenario_multiple_choice",
  ]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  explanation: z.string().trim().min(10).max(4000),
  tags: z.array(z.string().trim().min(1).max(40)).max(6).default([]),
  options: z
    .array(z.object({ content: z.string().trim().min(1).max(600), is_correct: z.boolean() }))
    .min(2)
    .max(6),
});

export const generatedQuestionsPayloadSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(1).max(5),
});

export type GenerateQuestionsInput = z.infer<typeof generateQuestionsSchema>;
export type GeneratedQuestionPayload = z.infer<typeof generatedQuestionSchema>;
