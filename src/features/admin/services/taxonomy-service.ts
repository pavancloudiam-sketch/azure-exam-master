import { supabase } from "@/integrations/supabase/client";
import type { Certification, Domain, Topic } from "../types/taxonomy";
import type {
  CertificationInput,
  DomainInput,
  NewVersionInput,
  RetireVersionInput,
  TopicInput,
} from "../validation/taxonomy-schemas";
import { recordAudit } from "./audit-service";

/* ---------------------------------- reads --------------------------------- */

export async function listCertifications(): Promise<Certification[]> {
  const { data, error } = await supabase
    .from("certifications")
    .select("*")
    .order("name", { ascending: true })
    .order("version", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listDomains(): Promise<Domain[]> {
  const { data, error } = await supabase
    .from("domains")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listTopics(): Promise<Topic[]> {
  const { data, error } = await supabase
    .from("topics")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

/* ------------------------------ certifications ----------------------------- */

export async function createCertification(input: CertificationInput): Promise<Certification> {
  const { data, error } = await supabase
    .from("certifications")
    .insert({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description ? input.description : null,
      provider: input.provider,
      exam_code: input.exam_code ? input.exam_code.toUpperCase() : null,
      version: input.version,
      effective_at: input.effective_at ? input.effective_at : null,
      lifecycle_status: "draft",
      is_active: false,
    })
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    action: "certification.created",
    entityType: "certification",
    entityId: data.id,
    entityLabel: data.name,
    details: { code: data.code, version: data.version, provider: data.provider },
  });
  return data;
}

export async function updateCertification(
  id: string,
  input: CertificationInput,
): Promise<Certification> {
  const { data, error } = await supabase
    .from("certifications")
    .update({
      code: input.code.toUpperCase(),
      name: input.name,
      description: input.description ? input.description : null,
      provider: input.provider,
      exam_code: input.exam_code ? input.exam_code.toUpperCase() : null,
      version: input.version,
      effective_at: input.effective_at ? input.effective_at : null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    action: "certification.updated",
    entityType: "certification",
    entityId: data.id,
    entityLabel: data.name,
    details: { code: data.code, version: data.version },
  });
  return data;
}

export async function setCertificationActive(
  row: Certification,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("certifications")
    .update({
      is_active: isActive,
      lifecycle_status: isActive ? "active" : row.lifecycle_status === "retired" ? "retired" : "draft",
      ...(isActive ? { allow_new_attempts: true } : {}),
    })
    .eq("id", row.id);
  if (error) throw error;
  await recordAudit({
    action: isActive ? "certification.activated" : "certification.deactivated",
    entityType: "certification",
    entityId: row.id,
    entityLabel: row.name,
  });
}

/* --------------------------- certification versions ------------------------ */

/** Creates the next version of a certification, optionally cloning its taxonomy. */
export async function createCertificationVersion(
  sourceId: string,
  input: NewVersionInput,
): Promise<Certification> {
  const { data, error } = await supabase.rpc("create_certification_version", {
    _source_id: sourceId,
    _version: input.version,
    _exam_code: input.exam_code ? input.exam_code.toUpperCase() : "",
    ...(input.effective_at ? { _effective_at: input.effective_at } : {}),
    _clone_taxonomy: input.clone_taxonomy === "yes",
  });
  if (error) throw error;
  return data as unknown as Certification;
}

/** Retires a version. Existing attempts stay tied to it; new attempts are blocked
 *  server-side unless the admin explicitly allows them. */
export async function retireCertificationVersion(
  certificationId: string,
  input: RetireVersionInput,
): Promise<Certification> {
  const { data, error } = await supabase.rpc("retire_certification_version", {
    _certification_id: certificationId,
    ...(input.retired_at ? { _retired_at: input.retired_at } : {}),
    _allow_new_attempts: input.allow_new_attempts === "yes",
  });
  if (error) throw error;
  return data as unknown as Certification;
}

/* ---------------------------------- domains -------------------------------- */

function weightValue(weight: DomainInput["weight_percent"]): number | null {
  return weight === "" || weight === undefined ? null : Number(weight);
}

export async function createDomain(input: DomainInput): Promise<Domain> {
  const { data, error } = await supabase
    .from("domains")
    .insert({
      certification_id: input.certification_id,
      name: input.name,
      weight_percent: weightValue(input.weight_percent),
      sort_order: input.sort_order,
    })
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    action: "domain.created",
    entityType: "domain",
    entityId: data.id,
    entityLabel: data.name,
    details: { certification_id: data.certification_id },
  });
  return data;
}

export async function updateDomain(id: string, input: DomainInput): Promise<Domain> {
  const { data, error } = await supabase
    .from("domains")
    .update({
      certification_id: input.certification_id,
      name: input.name,
      weight_percent: weightValue(input.weight_percent),
      sort_order: input.sort_order,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    action: "domain.updated",
    entityType: "domain",
    entityId: data.id,
    entityLabel: data.name,
  });
  return data;
}

export async function setDomainActive(row: Domain, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("domains")
    .update({ is_active: isActive })
    .eq("id", row.id);
  if (error) throw error;
  await recordAudit({
    action: isActive ? "domain.activated" : "domain.deactivated",
    entityType: "domain",
    entityId: row.id,
    entityLabel: row.name,
  });
}

/* ---------------------------------- topics --------------------------------- */

export async function createTopic(input: TopicInput): Promise<Topic> {
  const { data, error } = await supabase
    .from("topics")
    .insert({
      domain_id: input.domain_id,
      name: input.name,
      sort_order: input.sort_order,
    })
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    action: "topic.created",
    entityType: "topic",
    entityId: data.id,
    entityLabel: data.name,
    details: { domain_id: data.domain_id },
  });
  return data;
}

export async function updateTopic(id: string, input: TopicInput): Promise<Topic> {
  const { data, error } = await supabase
    .from("topics")
    .update({
      domain_id: input.domain_id,
      name: input.name,
      sort_order: input.sort_order,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  await recordAudit({
    action: "topic.updated",
    entityType: "topic",
    entityId: data.id,
    entityLabel: data.name,
  });
  return data;
}

export async function setTopicActive(row: Topic, isActive: boolean): Promise<void> {
  const { error } = await supabase.from("topics").update({ is_active: isActive }).eq("id", row.id);
  if (error) throw error;
  await recordAudit({
    action: isActive ? "topic.activated" : "topic.deactivated",
    entityType: "topic",
    entityId: row.id,
    entityLabel: row.name,
  });
}