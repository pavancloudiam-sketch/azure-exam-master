import type { AiFeature } from "../constants";
import type { CoachAction } from "../prompts/templates";

export type AiFeatureFlag = {
  key: AiFeature;
  label: string;
  description: string;
  isEnabled: boolean;
  updatedAt: string;
};

export type AiRole = "system" | "user" | "assistant";

export type AiMessage = { role: AiRole; content: string };

/** What every AI module hands to the service boundary. */
export type AiRequest = {
  feature: AiFeature;
  /** Rendered from a prompt template — never raw model instructions from the client. */
  system: string;
  messages: AiMessage[];
  /** Opaque ids only. Never personal data. */
  metadata?: Record<string, string | number | boolean>;
  attemptId?: string;
};

export type AiResult = {
  text: string;
  feature: AiFeature;
  model: string;
  requestId: string;
  disclaimer: string;
};

export type AiUsageSummary = {
  feature: AiFeature;
  usedLastHour: number;
  usedToday: number;
  perHour: number;
  perDay: number;
};

export type AiCoachReply = AiResult & { action: CoachAction };

export type AiInterviewReply = AiResult & {
  /** True once the planned number of questions has been reached. */
  isFinal: boolean;
  questionsAsked: number;
};

export type AiInterviewSessionSummary = {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  style: string;
  plannedQuestions: number;
  questionsAsked: number;
  status: string;
  createdAt: string;
};

export type AiInterviewSessionDetail = AiInterviewSessionSummary & {
  turns: { role: "user" | "assistant"; content: string }[];
};

export type AiErrorCode =
  | "ai_disabled"
  | "ai_forbidden"
  | "ai_rate_limited"
  | "ai_invalid_request"
  | "ai_unavailable"
  | "ai_quota_exhausted";

export class AiError extends Error {
  readonly code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.name = "AiError";
    this.code = code;
  }
}

/* AI Study Assistant */

export type StudyDomainStat = { domain: string; correct: number; total: number };
export type StudyTopicStat = { topic: string; domain: string; correct: number; total: number };

export type AiStudyOverview = {
  submittedAttempts: number;
  answeredQuestions: number;
  averagePercentage: number | null;
  weakDomains: StudyDomainStat[];
  weakTopics: StudyTopicStat[];
  recentMistakes: number;
  suggestedTopics: { topic: string; domain: string }[];
};

export type AiStudyReply = AiResult & {
  action: string;
  /** True when injection-like content was stripped from the student's input. */
  sanitizedInput: boolean;
};

/* AI Question Generator (admin only) */

export type GeneratedQuestionOption = { content: string; is_correct: boolean };

export type DuplicateMatch = {
  questionId: string;
  stem: string;
  /** 0-1 trigram similarity against the existing bank. */
  similarity: number;
};

export type GeneratedQuestionDraft = {
  /** Client-side id for the review list. Not a database id. */
  key: string;
  stem: string;
  scenario: string | null;
  questionType: string;
  difficulty: string;
  explanation: string;
  tags: string[];
  options: GeneratedQuestionOption[];
  duplicates: DuplicateMatch[];
};

export type AiGenerationResult = {
  requestId: string;
  model: string;
  disclaimer: string;
  drafts: GeneratedQuestionDraft[];
  /** True when injection-like content was stripped from admin guidance. */
  sanitizedInput: boolean;
};
