import { supabase } from "@/integrations/supabase/client";

import type { Exam, ExamQuestion, Question } from "../types/questions";
import type { ExamInput } from "../validation/exam-schemas";
import { recordAudit } from "./audit-service";

export type ExamAssignment = ExamQuestion & { question: Question };

const EXAM_COLUMNS =
  "id, certification_id, title, description, instructions, question_count, time_limit_minutes, passing_score, is_published, is_active, allow_timed, allow_practice, created_at, updated_at";

/* ---------------------------------- reads --------------------------------- */

export async function listAdminExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from("exams")
    .select(EXAM_COLUMNS)
    .order("title", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Exam[];
}

/**
 * Questions assigned to one exam, in delivery order. Correct answers are never
 * selected here; option keys stay behind the gated question functions.
 */
export async function listExamAssignments(examId: string): Promise<ExamAssignment[]> {
  const { data, error } = await supabase
    .from("exam_questions")
    .select(
      "id, exam_id, question_id, sort_order, created_at, question:questions(id, stem, question_type, difficulty, points, is_active, is_archived, topic_id, certification_id)",
    )
    .eq("exam_id", examId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ExamAssignment[];
}

/** Active, non-archived questions that can still be added to an exam. */
export async function listAssignableQuestions(
  certificationId: string,
  search: string,
): Promise<Question[]> {
  let query = supabase
    .from("questions")
    .select("id, stem, question_type, difficulty, points, is_active, is_archived, topic_id, certification_id")
    .eq("certification_id", certificationId)
    .eq("is_active", true)
    .eq("is_archived", false);

  if (search.trim()) {
    const term = `%${search.trim().replace(/[%,]/g, " ")}%`;
    query = query.ilike("stem", term);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as Question[];
}

/* --------------------------------- writes --------------------------------- */

function payload(input: ExamInput) {
  return {
    certification_id: input.certification_id,
    title: input.title,
    description: input.description ? input.description : null,
    instructions: input.instructions ? input.instructions : null,
    question_count: input.question_count,
    passing_score: input.passing_score,
    time_limit_minutes: input.allow_timed ? input.time_limit_minutes : input.time_limit_minutes,
    allow_timed: input.allow_timed,
    allow_practice: input.allow_practice,
    is_active: input.is_active,
  };
}

export async function createExam(input: ExamInput): Promise<Exam> {
  const { data, error } = await supabase
    .from("exams")
    .insert(payload(input))
    .select(EXAM_COLUMNS)
    .single();
  if (error) throw error;
  await recordAudit({
    action: "exam.created",
    entityType: "exam",
    entityId: data.id,
    entityLabel: data.title,
    details: { passing_score: input.passing_score, question_count: input.question_count },
  });
  return data as Exam;
}

export async function updateExam(id: string, input: ExamInput): Promise<Exam> {
  const { data, error } = await supabase
    .from("exams")
    .update(payload(input))
    .eq("id", id)
    .select(EXAM_COLUMNS)
    .single();
  if (error) throw error;
  await recordAudit({
    action: "exam.updated",
    entityType: "exam",
    entityId: id,
    entityLabel: data.title,
    details: { passing_score: input.passing_score, question_count: input.question_count },
  });
  return data as Exam;
}

/** Exams are never deleted; deactivation only hides them from new attempts. */
export async function setExamActive(exam: Exam, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("exams").update({ is_active: isActive }).eq("id", exam.id);
  if (error) throw error;
  await recordAudit({
    action: isActive ? "exam.activated" : "exam.deactivated",
    entityType: "exam",
    entityId: exam.id,
    entityLabel: exam.title,
  });
}

export async function setExamPublished(exam: Exam, isPublished: boolean): Promise<void> {
  const { error } = await supabase
    .from("exams")
    .update({ is_published: isPublished })
    .eq("id", exam.id);
  if (error) throw error;
  await recordAudit({
    action: isPublished ? "exam.published" : "exam.unpublished",
    entityType: "exam",
    entityId: exam.id,
    entityLabel: exam.title,
  });
}

export async function addQuestionToExam(exam: Exam, question: Question): Promise<void> {
  const { data: last, error: readError } = await supabase
    .from("exam_questions")
    .select("sort_order")
    .eq("exam_id", exam.id)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (readError) throw readError;

  const nextOrder = (last?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase
    .from("exam_questions")
    .insert({ exam_id: exam.id, question_id: question.id, sort_order: nextOrder });
  if (error) throw error;

  await recordAudit({
    action: "exam.question_assigned",
    entityType: "exam",
    entityId: exam.id,
    entityLabel: exam.title,
    details: { question_id: question.id, sort_order: nextOrder },
  });
}

/**
 * Removes the question from future deliveries only. Submitted attempts keep
 * their recorded answers and stay reviewable.
 */
export async function removeQuestionFromExamById(exam: Exam, questionId: string): Promise<void> {
  const { error } = await supabase
    .from("exam_questions")
    .delete()
    .eq("exam_id", exam.id)
    .eq("question_id", questionId);
  if (error) throw error;
  await recordAudit({
    action: "exam.question_removed",
    entityType: "exam",
    entityId: exam.id,
    entityLabel: exam.title,
    details: { question_id: questionId },
  });
}

/** Persists the delivery order of the assignments passed in, in array order. */
export async function reorderExamQuestions(
  exam: Exam,
  orderedRowIds: string[],
): Promise<void> {
  for (const [index, rowId] of orderedRowIds.entries()) {
    const { error } = await supabase
      .from("exam_questions")
      .update({ sort_order: index })
      .eq("id", rowId)
      .eq("exam_id", exam.id);
    if (error) throw error;
  }
  await recordAudit({
    action: "exam.questions_reordered",
    entityType: "exam",
    entityId: exam.id,
    entityLabel: exam.title,
    details: { order: orderedRowIds },
  });
}