import { supabase } from "@/integrations/supabase/client";
import type { QuestionInput } from "../validation/question-schemas";
import type {
  Exam,
  ExamQuestion,
  Question,
  QuestionOption,
  QuestionPage,
  QuestionSearchParams,
  QuestionStats,
  QuestionWithOptions,
} from "../types/questions";
import { recordAudit } from "./audit-service";
import type { Json } from "@/integrations/supabase/types";

/* ---------------------------------- reads --------------------------------- */

/**
 * `questions.explanation` is deliberately NOT selectable through the Data API:
 * a student with an active attempt could otherwise read the answer rationale
 * mid-exam. Explanations come from the gated `get_question_explanations`
 * function, which only serves admins and students with a submitted attempt.
 */
const QUESTION_COLUMNS =
  "id, exam_id, topic_id, stem, question_type, sort_order, created_at, updated_at, certification_id, scenario, difficulty, points, is_active, tags, governance_status, is_archived, review_flag, import_batch_id";

/** Keeps supabase-js from type-parsing long select strings (slow typecheck). */
const sel = (value: string): string => value;

export async function fetchExplanations(questionIds: string[]): Promise<Map<string, string | null>> {
  if (questionIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_question_explanations", {
    _question_ids: questionIds,
  });
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.question_id, row.explanation]));
}

export async function listQuestions(): Promise<QuestionWithOptions[]> {
  const { data, error } = await supabase
    .from("questions")
    .select(`${QUESTION_COLUMNS}, options:question_options(*)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const explanations = await fetchExplanations(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    explanation: explanations.get(row.id) ?? null,
    options: [...(row.options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  })) as QuestionWithOptions[];
}

export async function listExams(): Promise<Exam[]> {
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .order("title", { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Exam assignments. Scoped to the question ids currently on screen so the
 * admin list never pulls the whole join table; served by
 * `exam_questions_question_idx`.
 */
export async function listExamQuestions(questionIds?: string[]): Promise<ExamQuestion[]> {
  if (questionIds && questionIds.length === 0) return [];
  let query = supabase.from("exam_questions").select("id, exam_id, question_id, sort_order, created_at");
  if (questionIds) query = query.in("question_id", questionIds);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Paginated, filtered question search. Everything except the free-text search
 * is pushed into indexed SQL predicates so large banks stay responsive; only
 * one page of rows (and its options) ever crosses the wire.
 */
export async function searchQuestions(params: QuestionSearchParams): Promise<QuestionPage> {
  if (params.topicIds && params.topicIds.length === 0) return { rows: [], total: 0 };

  let query = supabase
    .from("questions")
    .select(sel(`${QUESTION_COLUMNS}, options:question_options(*)`), { count: "exact" });

  if (params.search.trim()) {
    const term = `%${params.search.trim().replace(/[%,]/g, " ")}%`;
    query = query.or(`stem.ilike.${term},scenario.ilike.${term}`);
  }
  if (params.certificationId !== "all") query = query.eq("certification_id", params.certificationId);
  if (params.topicId !== "all") query = query.eq("topic_id", params.topicId);
  else if (params.topicIds) query = query.in("topic_id", params.topicIds);
  if (params.difficulty !== "all") query = query.eq("difficulty", params.difficulty);
  if (params.questionType !== "all") query = query.eq("question_type", params.questionType);
  if (params.governanceStatus !== "all")
    query = query.eq("governance_status", params.governanceStatus);
  if (params.activeStatus === "archived") query = query.eq("is_archived", true);
  else {
    query = query.eq("is_archived", false);
    if (params.activeStatus === "active") query = query.eq("is_active", true);
    if (params.activeStatus === "inactive") query = query.eq("is_active", false);
  }
  if (params.tag.trim()) query = query.contains("tags", [params.tag.trim()]);
  if (params.reviewFlag !== "all") query = query.eq("review_flag", params.reviewFlag === "flagged");
  if (params.importBatchId !== "all") query = query.eq("import_batch_id", params.importBatchId);

  const from = (params.page - 1) * params.pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + params.pageSize - 1)
    .returns<(Question & { options: QuestionOption[] })[]>();
  if (error) throw error;

  const rows = data ?? [];
  const explanations = await fetchExplanations(rows.map((row) => row.id));
  return {
    total: count ?? 0,
    rows: rows.map((row) => ({
      ...row,
      explanation: explanations.get(row.id) ?? null,
      options: [...(row.options ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    })),
  };
}

/** Descriptive only — never used to mutate difficulty or publication state. */
export async function fetchQuestionStats(questionIds: string[]): Promise<Map<string, QuestionStats>> {
  if (questionIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_question_stats", {
    _question_ids: questionIds,
  });
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.question_id, row as QuestionStats]));
}

export async function listImportBatches() {
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, filename, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/* ------------------------------- bulk actions ------------------------------ */

export type BulkAction =
  | { kind: "activate" }
  | { kind: "deactivate" }
  | { kind: "archive" }
  | { kind: "assign_domain"; topicId: string }
  | { kind: "assign_topic"; topicId: string }
  | { kind: "add_tags"; tags: string[] }
  | { kind: "set_difficulty"; difficulty: string }
  | { kind: "technical_review" }
  | { kind: "language_review" };

export const BULK_ACTION_LABELS: Record<BulkAction["kind"], string> = {
  activate: "Activate",
  deactivate: "Deactivate",
  archive: "Archive",
  assign_domain: "Assign domain",
  assign_topic: "Assign topic",
  add_tags: "Add tags",
  set_difficulty: "Change difficulty",
  technical_review: "Move to technical review",
  language_review: "Move to language review",
};

/**
 * Applies one reviewed action to a selection. Every branch is a single indexed
 * statement, so the cost does not grow with the size of the question bank.
 * Nothing here deletes content; archiving is a status change.
 */
export async function applyBulkAction(questionIds: string[], action: BulkAction): Promise<number> {
  if (questionIds.length === 0) return 0;

  if (action.kind === "add_tags") {
    const { data, error } = await supabase.rpc("bulk_add_question_tags", {
      _question_ids: questionIds,
      _tags: action.tags,
    });
    if (error) throw error;
    await recordAudit({
      action: "question.bulk.add_tags",
      entityType: "question_bulk",
      entityLabel: `${questionIds.length} questions`,
      details: { question_ids: questionIds, tags: action.tags },
    });
    return data ?? questionIds.length;
  }

  const patch: Partial<Question> =
    action.kind === "activate"
      ? { is_active: true, is_archived: false }
      : action.kind === "deactivate"
        ? { is_active: false }
        : action.kind === "archive"
          ? { is_archived: true, is_active: false }
          : action.kind === "assign_domain" || action.kind === "assign_topic"
            ? { topic_id: action.topicId }
            : action.kind === "set_difficulty"
              ? { difficulty: action.difficulty }
              : action.kind === "technical_review"
                ? { governance_status: "technical_review", review_flag: true }
                : { governance_status: "language_review", review_flag: true };

  const { error } = await supabase.from("questions").update(patch).in("id", questionIds);
  if (error) throw error;

  await recordAudit({
    action: `question.bulk.${action.kind}`,
    entityType: "question_bulk",
    entityLabel: `${questionIds.length} questions`,
    details: { question_ids: questionIds, patch: patch as unknown as Json },
  });
  return questionIds.length;
}

/* --------------------------------- writes --------------------------------- */

const LABELS = "ABCDEFGH";

async function replaceOptions(questionId: string, input: QuestionInput): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("question_options")
    .select("id")
    .eq("question_id", questionId);
  if (readError) throw readError;

  const keptIds = new Set(input.options.map((option) => option.id).filter(Boolean) as string[]);
  const removed = (existing ?? []).filter((row) => !keptIds.has(row.id)).map((row) => row.id);

  for (const [index, option] of input.options.entries()) {
    const payload = {
      question_id: questionId,
      label: LABELS[index] ?? String(index + 1),
      content: option.content,
      is_correct: option.is_correct,
      sort_order: index,
    };
    if (option.id) {
      const { error } = await supabase
        .from("question_options")
        .update(payload)
        .eq("id", option.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("question_options").insert(payload);
      if (error) throw error;
    }
  }

  if (removed.length > 0) {
    const { error } = await supabase.from("question_options").delete().in("id", removed);
    if (error) throw error;
  }
}

export async function createQuestion(input: QuestionInput): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .insert({
      certification_id: input.certification_id,
      topic_id: input.topic_id,
      question_type: input.question_type,
      scenario: input.scenario?.trim() ? input.scenario.trim() : null,
      stem: input.stem,
      explanation: input.explanation,
      difficulty: input.difficulty,
      points: input.points,
      is_active: input.is_active,
    })
    .select(QUESTION_COLUMNS)
    .single();
  if (error) throw error;

  await replaceOptions(data.id, input);
  await recordAudit({
    action: "question.created",
    entityType: "question",
    entityId: data.id,
    entityLabel: data.stem.slice(0, 120),
    details: { question_type: data.question_type, difficulty: data.difficulty },
  });
  return { ...data, explanation: input.explanation } as Question;
}

export async function updateQuestion(id: string, input: QuestionInput): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .update({
      certification_id: input.certification_id,
      topic_id: input.topic_id,
      question_type: input.question_type,
      scenario: input.scenario?.trim() ? input.scenario.trim() : null,
      stem: input.stem,
      explanation: input.explanation,
      difficulty: input.difficulty,
      points: input.points,
      is_active: input.is_active,
    })
    .eq("id", id)
    .select(QUESTION_COLUMNS)
    .single();
  if (error) throw error;

  await replaceOptions(id, input);
  await recordAudit({
    action: "question.updated",
    entityType: "question",
    entityId: id,
    entityLabel: data.stem.slice(0, 120),
    details: { question_type: data.question_type, difficulty: data.difficulty },
  });
  return { ...data, explanation: input.explanation } as Question;
}

export async function setQuestionActive(row: Question, isActive: boolean): Promise<void> {
  return setQuestionActiveInternal(row, isActive);
}

/**
 * Saves one AI-drafted question into the DRAFT bank.
 *
 * Never publishable in one step: the row is written inactive, with
 * governance_status 'draft', flagged for review and tagged as AI-generated,
 * so it must go through the existing technical/language review workflow
 * before an admin can activate it or assign it to an exam.
 */
export async function createAiDraftQuestion(
  input: QuestionInput,
  meta: { requestId: string; model: string; duplicateCount: number },
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .insert({
      certification_id: input.certification_id,
      topic_id: input.topic_id,
      question_type: input.question_type,
      scenario: input.scenario?.trim() ? input.scenario.trim() : null,
      stem: input.stem,
      explanation: input.explanation,
      difficulty: input.difficulty,
      points: input.points,
      is_active: false,
      is_archived: false,
      governance_status: "draft",
      review_flag: true,
      tags: ["ai-generated"],
    })
    .select(QUESTION_COLUMNS)
    .single();
  if (error) throw error;

  await replaceOptions(data.id, { ...input, is_active: false });
  await recordAudit({
    action: "question.ai_draft_saved",
    entityType: "question",
    entityId: data.id,
    entityLabel: data.stem.slice(0, 120),
    details: {
      request_id: meta.requestId,
      model: meta.model,
      duplicate_matches: meta.duplicateCount,
      governance_status: "draft",
    },
  });
  return { ...data, explanation: input.explanation } as Question;
}

async function setQuestionActiveInternal(row: Question, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("questions")
    .update({ is_active: isActive })
    .eq("id", row.id);
  if (error) throw error;
  await recordAudit({
    action: isActive ? "question.activated" : "question.deactivated",
    entityType: "question",
    entityId: row.id,
    entityLabel: row.stem.slice(0, 120),
  });
}

/* --------------------------- exam assignments ----------------------------- */

export async function assignQuestionToExam(question: Question, examId: string): Promise<void> {
  const { error } = await supabase
    .from("exam_questions")
    .insert({ exam_id: examId, question_id: question.id, sort_order: 0 });
  if (error) throw error;
  await recordAudit({
    action: "question.assigned_to_exam",
    entityType: "question",
    entityId: question.id,
    entityLabel: question.stem.slice(0, 120),
    details: { exam_id: examId },
  });
}

/**
 * Removes the question from future exam deliveries. Submitted attempts keep
 * their recorded answers, so historical review data is unaffected.
 */
export async function removeQuestionFromExam(question: Question, examId: string): Promise<void> {
  const { error } = await supabase
    .from("exam_questions")
    .delete()
    .eq("exam_id", examId)
    .eq("question_id", question.id);
  if (error) throw error;
  await recordAudit({
    action: "question.removed_from_exam",
    entityType: "question",
    entityId: question.id,
    entityLabel: question.stem.slice(0, 120),
    details: { exam_id: examId },
  });
}