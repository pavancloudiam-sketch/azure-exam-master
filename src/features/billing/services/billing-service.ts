import { supabase } from "@/integrations/supabase/client";
import type {
  BillingProfile,
  InvoiceDetail,
  NotificationRecord,
  RefundRecord,
  SubscriptionRecord,
} from "../types";

/** Billing profile (India-oriented tax fields; GST number optional). */
export async function getMyBillingProfile(): Promise<BillingProfile | null> {
  const { data, error } = await supabase.from("billing_profiles").select("*").maybeSingle();
  if (error) throw error;
  return (data ?? null) as BillingProfile | null;
}

export type BillingProfileInput = Omit<BillingProfile, "id" | "user_id" | "country">;

export async function saveMyBillingProfile(input: BillingProfileInput): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not signed in");

  const payload = { ...input, user_id: userId, country: "IN" };
  const { error } = await supabase.from("billing_profiles").upsert(payload, {
    onConflict: "user_id",
  });
  if (error) throw error;
}

/** Subscriptions. Cancellation is a request handled by the database routine. */
export async function listMySubscriptions(): Promise<SubscriptionRecord[]> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, status, current_period_start, current_period_end, cancel_at_period_end, cancelled_at, provider, products(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as SubscriptionRecord[];
}

export async function requestSubscriptionCancellation(
  subscriptionId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("request_subscription_cancellation", {
    _subscription_id: subscriptionId,
    _reason: reason,
  });
  if (error) throw error;
}

export async function withdrawSubscriptionCancellation(subscriptionId: string): Promise<void> {
  const { error } = await supabase.rpc("withdraw_subscription_cancellation", {
    _subscription_id: subscriptionId,
  });
  if (error) throw error;
}

/** Refunds. Students see only their own rows (RLS). */
export async function listMyRefunds(): Promise<RefundRecord[]> {
  const { data, error } = await supabase
    .from("refunds")
    .select("id, order_id, amount_minor, reason, status, decision_note, decided_at, created_at, orders(order_number, user_id)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as RefundRecord[];
}

export async function requestRefund(orderId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("request_refund", {
    _order_id: orderId,
    _reason: reason,
  });
  if (error) throw error;
}

/** Invoice / receipt. */
export async function getInvoice(invoiceId: string): Promise<InvoiceDetail | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, currency, subtotal_minor, discount_minor, tax_minor, total_minor, tax_note, buyer_gstin, place_of_supply, issued_at, orders(order_number, placed_at, order_items(id, product_name, quantity, total_minor))",
    )
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as InvoiceDetail | null;
}

export async function listMyNotifications(): Promise<NotificationRecord[]> {
  const { data, error } = await supabase
    .from("email_notifications")
    .select(
      "id, template, subject, body, status, attempts, last_error, scheduled_for, sent_at, to_email, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as NotificationRecord[];
}

export async function requestExamReminder(examId: string, remindAt: Date): Promise<void> {
  const { error } = await supabase.rpc("request_exam_reminder", {
    _exam_id: examId,
    _remind_at: remindAt.toISOString(),
  });
  if (error) throw error;
}

/**
 * Queues the "result available" message. The routine is idempotent per
 * attempt, so repeated views never queue a second email.
 */
export async function notifyResultAvailable(attemptId: string): Promise<void> {
  const { error } = await supabase.rpc("notify_result_available", { _attempt_id: attemptId });
  if (error) throw error;
}