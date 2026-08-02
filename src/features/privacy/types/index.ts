export type ExportScope = "user" | "organization";

export type DataExportRequest = {
  id: string;
  scope: ExportScope;
  user_id: string;
  organization_id: string | null;
  status: string;
  byte_size: number;
  download_count: number;
  requested_at: string;
  expires_at: string;
};

export type DeletionStatus = "pending" | "cancelled" | "approved" | "rejected" | "completed";

export type AccountDeletionRequest = {
  id: string;
  user_id: string;
  status: DeletionStatus;
  reason: string | null;
  requested_at: string;
  scheduled_for: string;
  decided_at: string | null;
  decision_note: string | null;
  completed_at: string | null;
};

export type OrganizationDeletionRequest = {
  id: string;
  organization_id: string;
  status: DeletionStatus;
  reason: string | null;
  requested_at: string;
  scheduled_for: string;
  decided_at: string | null;
  decision_note: string | null;
  completed_at: string | null;
};

export type RetentionPolicy = {
  id: string;
  organization_id: string | null;
  attempt_retention_days: number | null;
  ai_log_retention_days: number;
  api_log_retention_days: number;
  export_ttl_hours: number;
  deletion_grace_days: number;
  notes: string | null;
  updated_at: string;
};

export type ConsentRecord = {
  doc_type: string;
  version: string;
  context: string;
  accepted_at: string;
};

export const DELETION_STATUS_TONE: Record<DeletionStatus, "info" | "success" | "warning" | "error" | "neutral"> = {
  pending: "warning",
  approved: "info",
  cancelled: "neutral",
  rejected: "error",
  completed: "success",
};