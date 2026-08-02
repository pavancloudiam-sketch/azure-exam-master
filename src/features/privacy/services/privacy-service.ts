import { supabase } from "@/integrations/supabase/client";
import type {
  AccountDeletionRequest,
  ConsentRecord,
  DataExportRequest,
  OrganizationDeletionRequest,
  RetentionPolicy,
} from "../types";

/**
 * Data-rights reads and writes. Every routine below is a database function or
 * a row-level-security protected read: a caller who tampers with an id in the
 * browser still cannot reach another person's or another tenant's records.
 */

const EXPORT_COLUMNS =
  "id, scope, user_id, organization_id, status, byte_size, download_count, requested_at, expires_at";

export async function listMyExports(): Promise<DataExportRequest[]> {
  const { data, error } = await supabase
    .from("data_export_requests")
    .select(EXPORT_COLUMNS)
    .eq("scope", "user")
    .order("requested_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as DataExportRequest[];
}

export async function listOrganizationExports(orgId: string): Promise<DataExportRequest[]> {
  const { data, error } = await supabase
    .from("data_export_requests")
    .select(EXPORT_COLUMNS)
    .eq("organization_id", orgId)
    .order("requested_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as DataExportRequest[];
}

export async function createMyExport(): Promise<DataExportRequest> {
  const { data, error } = await supabase.rpc("export_my_data");
  if (error) throw error;
  return data as unknown as DataExportRequest;
}

export async function createOrganizationExport(orgId: string): Promise<DataExportRequest> {
  const { data, error } = await supabase.rpc("export_organization_data", {
    _organization_id: orgId,
  });
  if (error) throw error;
  return data as unknown as DataExportRequest;
}

/** Fetches the stored payload and records the download in the audit log. */
export async function downloadExport(exportId: string): Promise<unknown> {
  const { data, error } = await supabase
    .from("data_export_requests")
    .select("payload, status")
    .eq("id", exportId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This export is no longer available.");
  if (data.status !== "ready") throw new Error("This export has expired. Request a new one.");
  const { error: logError } = await supabase.rpc("record_export_download", { _export_id: exportId });
  if (logError) throw logError;
  return data.payload;
}

export async function getMyConsents(): Promise<ConsentRecord[]> {
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("doc_type, version, context, accepted_at")
    .order("accepted_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ConsentRecord[];
}

export async function getMyDeletionRequest(): Promise<AccountDeletionRequest | null> {
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AccountDeletionRequest | null) ?? null;
}

export async function requestAccountDeletion(reason: string) {
  const { error } = await supabase.rpc("request_account_deletion", { _reason: reason });
  if (error) throw error;
}

export async function cancelAccountDeletion() {
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (error) throw error;
}

export async function getOrganizationDeletionRequest(
  orgId: string,
): Promise<OrganizationDeletionRequest | null> {
  const { data, error } = await supabase
    .from("organization_deletion_requests")
    .select("*")
    .eq("organization_id", orgId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as OrganizationDeletionRequest | null) ?? null;
}

export async function requestOrganizationDeletion(orgId: string, reason: string) {
  const { error } = await supabase.rpc("request_organization_deletion", {
    _organization_id: orgId,
    _reason: reason,
  });
  if (error) throw error;
}

export async function cancelOrganizationDeletion(orgId: string) {
  const { error } = await supabase.rpc("cancel_organization_deletion", {
    _organization_id: orgId,
  });
  if (error) throw error;
}

export async function getRetentionPolicy(orgId: string | null): Promise<RetentionPolicy | null> {
  const query = supabase.from("retention_policies").select("*");
  const { data, error } = orgId
    ? await query.eq("organization_id", orgId).maybeSingle()
    : await query.is("organization_id", null).maybeSingle();
  if (error) throw error;
  return (data as RetentionPolicy | null) ?? null;
}

export async function saveRetentionPolicy(input: {
  organizationId: string | null;
  aiLogRetentionDays: number;
  apiLogRetentionDays: number;
  exportTtlHours: number;
  deletionGraceDays: number;
  notes?: string | null;
}) {
  // `_organization_id` is nullable in SQL (null = the platform default) but the
  // generated types widen it to string, so the argument object is cast once here.
  const { error } = await supabase.rpc("upsert_retention_policy", {
    _organization_id: input.organizationId,
    _ai_log_retention_days: input.aiLogRetentionDays,
    _api_log_retention_days: input.apiLogRetentionDays,
    _export_ttl_hours: input.exportTtlHours,
    _deletion_grace_days: input.deletionGraceDays,
    _notes: input.notes ?? undefined,
  } as never);
  if (error) throw error;
}

/** Platform administrator queues. */
export async function listOpenAccountDeletions(): Promise<AccountDeletionRequest[]> {
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("*")
    .in("status", ["pending", "approved"])
    .order("requested_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AccountDeletionRequest[];
}

export async function listOpenOrganizationDeletions(): Promise<OrganizationDeletionRequest[]> {
  const { data, error } = await supabase
    .from("organization_deletion_requests")
    .select("*")
    .in("status", ["pending", "approved"])
    .order("requested_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OrganizationDeletionRequest[];
}

export async function decideAccountDeletion(id: string, decision: string, note: string) {
  const { error } = await supabase.rpc("decide_account_deletion", {
    _request_id: id,
    _decision: decision,
    _note: note,
  });
  if (error) throw error;
}

export async function decideOrganizationDeletion(id: string, decision: string, note: string) {
  const { error } = await supabase.rpc("decide_organization_deletion", {
    _request_id: id,
    _decision: decision,
    _note: note,
  });
  if (error) throw error;
}

/** Triggers a browser download of an export payload as pretty-printed JSON. */
export function saveJsonFile(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}