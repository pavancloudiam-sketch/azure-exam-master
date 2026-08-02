import type { Tables } from "@/integrations/supabase/types";

export type Exam = Tables<"exams">;

export type AttemptMode = "timed" | "practice";

export const ATTEMPT_MODE_LABELS: Record<AttemptMode, string> = {
  timed: "Timed",
  practice: "Practice",
};