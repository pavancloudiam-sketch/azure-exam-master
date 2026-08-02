import { supabase } from "@/integrations/supabase/client";
import type { Exam } from "../types";

/** Published exams a student may start. RLS hides unpublished exams. */
export async function listPublishedExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("is_published", true)
    .order("title", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getExam(examId: string): Promise<Exam | null> {
  const { data, error } = await supabase.from("exams").select("*").eq("id", examId).maybeSingle();
  if (error) throw error;
  return data;
}