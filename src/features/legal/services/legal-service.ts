import { supabase } from "@/integrations/supabase/client";

export const LEGAL_DOC_TYPES = ["terms_of_service", "privacy_policy", "refund_policy"] as const;
export type LegalDocType = (typeof LEGAL_DOC_TYPES)[number];

export const LEGAL_SLUGS: Record<string, LegalDocType> = {
  terms: "terms_of_service",
  privacy: "privacy_policy",
  refunds: "refund_policy",
};

export const LEGAL_LABELS: Record<LegalDocType, string> = {
  terms_of_service: "Terms of Service",
  privacy_policy: "Privacy Policy",
  refund_policy: "Refund Policy",
};

export type LegalDocument = {
  id: string;
  doc_type: LegalDocType;
  version: string;
  title: string;
  summary: string | null;
  body: string;
  is_placeholder: boolean;
  effective_at: string | null;
  updated_at: string;
};

export async function getCurrentLegalDocument(docType: LegalDocType): Promise<LegalDocument | null> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, doc_type, version, title, summary, body, is_placeholder, effective_at, updated_at")
    .eq("doc_type", docType)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw error;
  return (data as LegalDocument | null) ?? null;
}

export async function listCurrentLegalDocuments(): Promise<LegalDocument[]> {
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, doc_type, version, title, summary, body, is_placeholder, effective_at, updated_at")
    .eq("is_current", true);
  if (error) throw error;
  return (data ?? []) as LegalDocument[];
}

const PENDING_KEY = "askmeexam.pending-legal-acceptance";

/**
 * Records acceptance of every current policy version for the signed-in user.
 * The database function stamps the user and timestamp, so a client can never
 * record an acceptance for someone else or backdate one.
 */
export async function recordLegalAcceptance(
  context: "registration" | "checkout" | "reacceptance" = "registration",
): Promise<void> {
  const { error } = await supabase.rpc("accept_current_legal_documents", { _context: context });
  if (error) throw error;
}

/** Registration may finish before the email is confirmed; remember the tick. */
export function markAcceptancePending(): void {
  try {
    window.localStorage.setItem(PENDING_KEY, "1");
  } catch {
    /* storage unavailable — acceptance is re-captured at next sign-in */
  }
}

export async function flushPendingAcceptance(): Promise<void> {
  let pending = false;
  try {
    pending = window.localStorage.getItem(PENDING_KEY) === "1";
  } catch {
    return;
  }
  if (!pending) return;
  try {
    await recordLegalAcceptance("registration");
    window.localStorage.removeItem(PENDING_KEY);
  } catch {
    /* retried on the next successful sign-in */
  }
}

export async function listMyAcceptances() {
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("id, doc_type, version, context, accepted_at")
    .order("accepted_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}