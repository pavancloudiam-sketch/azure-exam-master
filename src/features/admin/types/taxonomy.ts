import type { Tables } from "@/integrations/supabase/types";

export type Certification = Tables<"certifications">;
export type Domain = Tables<"domains">;
export type Topic = Tables<"topics">;
export type AuditLog = Tables<"audit_logs">;

export type ActiveFilter = "all" | "active" | "inactive";