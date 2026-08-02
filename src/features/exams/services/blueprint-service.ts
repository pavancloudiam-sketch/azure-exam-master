import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

import type { BlueprintDomainView, BlueprintView, ExamBlueprint } from "../types";

export type ScoringModel = Tables<"scoring_models">;

/** Per-skill-area readiness returned by `get_blueprint_readiness`. */
export type BlueprintDomainReadiness = {
  domain_id: string;
  name: string;
  required: number;
  available: number;
  satisfied: boolean;
};

export type BlueprintReadiness = {
  blueprint_id: string;
  satisfiable: boolean;
  total_available: number;
  max_question_count: number;
  default_question_count: number;
  domains: BlueprintDomainReadiness[];
};

export type ReadinessCount = { name: string; approved: number };

/** Question-bank readiness returned by `get_question_bank_readiness`. */
export type QuestionBankReadiness = {
  total: number;
  approved: number;
  awaiting_review: number;
  flagged_duplicates: number;
  missing_explanation: number;
  missing_metadata: number;
  by_domain: ReadinessCount[];
  by_topic: ReadinessCount[];
  by_type: ReadinessCount[];
  by_difficulty: ReadinessCount[];
  non_repeating_50q_attempts: number;
  estimate_note: string;
};

function toDomainViews(
  rows: Array<Tables<"exam_blueprint_domains"> & { domains: { name: string } | null }>,
): BlueprintDomainView[] {
  return rows
    .map((row) => ({
      domain_id: row.domain_id,
      name: row.domains?.name ?? "Unnamed skill area",
      min_percent: Number(row.min_percent),
      max_percent: Number(row.max_percent),
      sort_order: row.sort_order,
      topic_quotas: row.topic_quotas,
    }))
    .sort((a, b) => a.sort_order - b.sort_order);
}

/**
 * The published blueprint that governs a given exam. Students may read
 * published blueprints only; RLS enforces that, so the start screen can show
 * the real question count, duration and weighting without an admin round trip.
 */
export async function getExamBlueprint(examId: string): Promise<BlueprintView | null> {
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("blueprint_id")
    .eq("id", examId)
    .maybeSingle();
  if (examError) throw examError;
  if (!exam?.blueprint_id) return null;
  return getBlueprint(exam.blueprint_id);
}

export async function getBlueprint(blueprintId: string): Promise<BlueprintView | null> {
  const { data, error } = await supabase
    .from("exam_blueprints")
    .select("*")
    .eq("id", blueprintId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: domains, error: domainError } = await supabase
    .from("exam_blueprint_domains")
    .select("*, domains(name)")
    .eq("blueprint_id", blueprintId);
  if (domainError) throw domainError;

  return { ...data, domains: toDomainViews(domains ?? []) };
}

/** Every blueprint an admin may manage, newest certification grouping first. */
export async function listBlueprints(): Promise<
  Array<ExamBlueprint & { certification: { code: string; name: string } | null }>
> {
  const { data, error } = await supabase
    .from("exam_blueprints")
    .select("*, certifications(code, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { certifications, ...blueprint } = row as typeof row & {
      certifications: { code: string; name: string } | null;
    };
    return { ...blueprint, certification: certifications };
  });
}

export async function createBlueprint(
  input: TablesInsert<"exam_blueprints">,
): Promise<ExamBlueprint> {
  const { data, error } = await supabase
    .from("exam_blueprints")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateBlueprint(
  blueprintId: string,
  input: TablesUpdate<"exam_blueprints">,
): Promise<ExamBlueprint> {
  const { data, error } = await supabase
    .from("exam_blueprints")
    .update(input)
    .eq("id", blueprintId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Publishing is guarded in the database: a `BEFORE UPDATE` trigger re-runs the
 * readiness check and refuses to publish a blueprint the question bank cannot
 * satisfy. The UI pre-checks purely so the admin sees the shortfall early.
 */
export async function setBlueprintPublished(
  blueprintId: string,
  published: boolean,
): Promise<ExamBlueprint> {
  return updateBlueprint(blueprintId, { is_published: published });
}

export async function deleteBlueprint(blueprintId: string): Promise<void> {
  const { error } = await supabase.from("exam_blueprints").delete().eq("id", blueprintId);
  if (error) throw error;
}

/** Replaces the skill-area weighting rows for a blueprint in one pass. */
export async function replaceBlueprintDomains(
  blueprintId: string,
  rows: Array<{
    domain_id: string;
    min_percent: number;
    max_percent: number;
    sort_order: number;
    topic_quotas?: Json;
  }>,
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("exam_blueprint_domains")
    .delete()
    .eq("blueprint_id", blueprintId);
  if (deleteError) throw deleteError;
  if (rows.length === 0) return;
  const { error } = await supabase.from("exam_blueprint_domains").insert(
    rows.map((row) => ({
      blueprint_id: blueprintId,
      domain_id: row.domain_id,
      min_percent: row.min_percent,
      max_percent: row.max_percent,
      sort_order: row.sort_order,
      topic_quotas: row.topic_quotas ?? {},
    })),
  );
  if (error) throw error;
}

export async function listScoringModels(): Promise<ScoringModel[]> {
  const { data, error } = await supabase
    .from("scoring_models")
    .select("*")
    .order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBlueprintReadiness(blueprintId: string): Promise<BlueprintReadiness> {
  const { data, error } = await supabase.rpc("get_blueprint_readiness", {
    _blueprint_id: blueprintId,
  });
  if (error) throw error;
  return data as unknown as BlueprintReadiness;
}

export async function getQuestionBankReadiness(
  certificationId: string,
): Promise<QuestionBankReadiness> {
  const { data, error } = await supabase.rpc("get_question_bank_readiness", {
    _certification_id: certificationId,
  });
  if (error) throw error;
  return data as unknown as QuestionBankReadiness;
}
