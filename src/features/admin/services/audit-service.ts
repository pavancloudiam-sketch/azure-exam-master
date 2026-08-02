import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type AuditEntry = {
  action: string;
  entityType:
    | "certification"
    | "domain"
    | "topic"
    | "question"
    | "question_bulk"
    | "import_batch"
    | "exam"
    | "application_settings"
    | "user_role";
  entityId?: string;
  entityLabel: string;
  details?: Record<string, Json>;
};

/**
 * Records an admin action. RLS only allows inserts where actor_id is the
 * signed-in admin, so audit rows cannot be forged for another user.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const actorId = data.user?.id;
  if (!actorId) return;

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    entity_label: entry.entityLabel,
    details: (entry.details ?? {}) as Json,
  });

  if (error) console.error("audit log failed", error.message);
}

export async function listAuditLogs(limit = 25) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}