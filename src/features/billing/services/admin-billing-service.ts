import { supabase } from "@/integrations/supabase/client";
import type { NotificationRecord, RefundRecord } from "../types";

/** Admin refund queue. RLS lets admins read every refund row. */
export async function listRefundsForReview(status?: string): Promise<RefundRecord[]> {
  let query = supabase
    .from("refunds")
    .select(
      "id, order_id, amount_minor, reason, status, decision_note, decided_at, created_at, orders(order_number, user_id)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as RefundRecord[];
}

export async function decideRefund(
  refundId: string,
  decision: "approved" | "rejected",
  note: string,
): Promise<void> {
  const { error } = await supabase.rpc("decide_refund", {
    _refund_id: refundId,
    _decision: decision,
    _note: note,
  });
  if (error) throw error;
}

export async function markRefundProcessed(refundId: string, reference: string): Promise<void> {
  const { error } = await supabase.rpc("mark_refund_processed", {
    _refund_id: refundId,
    _provider_reference: reference,
  });
  if (error) throw error;
}

export async function listAllNotifications(status?: string): Promise<NotificationRecord[]> {
  let query = supabase
    .from("email_notifications")
    .select(
      "id, template, subject, body, status, attempts, last_error, scheduled_for, sent_at, to_email, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NotificationRecord[];
}

/**
 * Test mode: records the send instead of contacting a mail provider. The
 * routine ignores an already-sent message, so retrying cannot duplicate it.
 */
export async function markNotificationSent(id: string, failure?: string): Promise<void> {
  const args = failure
    ? { _notification_id: id, _error: failure }
    : { _notification_id: id };
  const { error: rpcError } = await supabase.rpc("mark_notification_sent", args);
  if (rpcError) throw rpcError;
}

export async function findStudentByEmail(email: string): Promise<{ id: string; email: string | null } | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createTestOrder(
  userId: string,
  productId: string,
  outcome: "paid" | "failed",
): Promise<void> {
  const { error } = await supabase.rpc("admin_create_test_order", {
    _user_id: userId,
    _product_id: productId,
    _outcome: outcome,
  });
  if (error) throw error;
}

export async function listAdminProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, code, product_type, is_active")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}