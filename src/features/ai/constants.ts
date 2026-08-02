/** Every AI module is gated by one of these keys. */
export const AI_FEATURES = [
  "ai_coach",
  "ai_study_assistant",
  "ai_interview_coach",
  "ai_question_generator",
] as const;

export type AiFeature = (typeof AI_FEATURES)[number];

/** Admin-only modules; students can never invoke these even if enabled. */
export const ADMIN_ONLY_FEATURES: readonly AiFeature[] = ["ai_question_generator"];

/**
 * Per-user request budgets. Enforced server-side against ai_usage_logs, so a
 * client cannot bypass them by calling the server function directly.
 *
 * Performance coaching is part of the Study Assistant budget — it is an action
 * inside that module, not a module of its own.
 */
export const AI_RATE_LIMITS: Record<AiFeature, { perHour: number; perDay: number }> = {
  ai_coach: { perHour: 40, perDay: 150 },
  ai_study_assistant: { perHour: 40, perDay: 150 },
  ai_interview_coach: { perHour: 40, perDay: 150 },
  ai_question_generator: { perHour: 30, perDay: 120 },
};


/** Conversation ceiling shared by every conversational AI module. */
export const AI_CONVERSATION_LIMITS = {
  maxTurns: 20,
  maxUserMessageChars: 2000,
  maxOutputTokens: 1200,
};

export const AI_MODEL = "google/gemini-3.6-flash";

export const AI_BRAND_NAME = "AskMe AI";

/** Shown next to every AI surface. Wording is deliberate and legal-facing. */
export const AI_DISCLAIMER =
  "AskMe AI generates original educational guidance. It is not affiliated with, endorsed by, or an official source for Microsoft, and its answers may be incomplete or inaccurate. Always confirm against official Microsoft documentation.";

export const AI_GENERATED_LABEL = "AI-generated — supplementary guidance, not a stored answer key.";

/** Interview coach options offered to the student. */
export const INTERVIEW_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type InterviewDifficulty = (typeof INTERVIEW_DIFFICULTIES)[number];

export const INTERVIEW_STYLES = ["conceptual", "scenario", "troubleshooting", "mixed"] as const;
export type InterviewStyle = (typeof INTERVIEW_STYLES)[number];

export const INTERVIEW_LENGTHS = [3, 5, 8, 10] as const;

export const INTERVIEW_TOPICS = [
  "Entra ID fundamentals",
  "Users, groups and administrative units",
  "Authentication and MFA",
  "Conditional Access",
  "Identity Protection",
  "Application registrations and enterprise apps",
  "Role-based access control and PIM",
  "Identity governance and access reviews",
  "Hybrid identity and Entra Connect",
  "Monitoring, logs and troubleshooting",
] as const;

export const INTERVIEW_DIFFICULTY_LABELS: Record<InterviewDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const INTERVIEW_STYLE_LABELS: Record<InterviewStyle, string> = {
  conceptual: "Conceptual questions",
  scenario: "Scenario-based questions",
  troubleshooting: "Troubleshooting questions",
  mixed: "Mixed mock interview",
};

export const INTERVIEW_MAX_TITLE_CHARS = 120;

/** Practice-only wording shown on every interview surface. */
export const INTERVIEW_DISCLAIMER =
  "This is practice only. AskMe AI is not an employer, and its feedback does not represent any real hiring decision, assessment score, or Microsoft endorsement.";
