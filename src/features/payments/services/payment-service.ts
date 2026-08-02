import { supabase } from "@/integrations/supabase/client";

export type UpiPaymentStatus = {
  order_id: string;
  order_number: string;
  order_status:
    | "draft"
    | "pending_payment"
    | "paid"
    | "failed"
    | "cancelled"
    | "expired"
    | "refunded"
    | "partially_refunded";
  payment_status: "created" | "pending" | "succeeded" | "failed" | "cancelled";
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
  expires_at: string | null;
  paid_at: string | null;
  exam_id: string | null;
};

/**
 * Server-authoritative payment status. The browser only reads it — success is
 * decided by the verified webhook, never here.
 */
export async function getUpiPaymentStatus(orderId: string): Promise<UpiPaymentStatus> {
  const { data, error } = await supabase.rpc("get_upi_payment_status", { _order_id: orderId });
  if (error) throw error;
  return data as unknown as UpiPaymentStatus;
}

export async function cancelUpiOrder(orderId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_upi_order", { _order_id: orderId });
  if (error) throw error;
}

export type ExamAccess = {
  exam_id: string;
  requires_purchase: boolean;
  has_access: boolean;
  product_id: string | null;
};

export async function getExamAccessMap(): Promise<ExamAccess[]> {
  const { data, error } = await supabase.rpc("get_exam_access_map");
  if (error) throw error;
  return (data ?? []) as unknown as ExamAccess[];
}

export type AdminOrderRow = {
  id: string;
  order_number: string;
  status: string;
  total_minor: number;
  created_at: string;
  paid_at: string | null;
  user_id: string;
  order_items: { product_name: string }[];
  payment_attempts: { provider: string; method: string | null; status: string }[];
};

/** Admin order ledger. RLS lets admins read every order row. */
export async function listOrdersForAdmin(status?: string): Promise<AdminOrderRow[]> {
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, status, total_minor, created_at, paid_at, user_id, order_items(product_name), payment_attempts(provider, method, status)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AdminOrderRow[];
}
