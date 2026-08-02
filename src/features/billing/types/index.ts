export type ProductType = "one_time_exam" | "subscription";
export type AccessScope = "exam" | "certification" | "all";

export type CatalogPrice = {
  id: string;
  currency: string;
  amount_minor: number;
  billing_interval: "month" | "year" | null;
  interval_count: number;
};

export type CatalogProduct = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  product_type: ProductType;
  access_scope: AccessScope;
  access_days: number | null;
  sort_order: number;
  prices: CatalogPrice[];
};

export type PurchaseRecord = {
  id: string;
  order_number: string;
  status: string;
  currency: string;
  total_minor: number;
  placed_at: string | null;
  created_at: string;
  order_items: { id: string; product_name: string; quantity: number; total_minor: number }[];
  invoices: { id: string; invoice_number: string; status: string; issued_at: string | null }[];
  refunds: { id: string; amount_minor: number; status: string; created_at: string }[];
};

export type EntitlementRecord = {
  id: string;
  access_scope: AccessScope;
  source: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  products: { name: string } | null;
};

/** Formats paise as Indian rupees. Launch jurisdiction is India only. */
export function formatInr(amountMinor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountMinor / 100);
}
export type BillingProfile = {
  id: string;
  user_id: string;
  legal_name: string;
  is_business: boolean;
  gstin: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state_name: string | null;
  state_code: string | null;
  postal_code: string | null;
  country: string;
  place_of_supply: string | null;
};

export type SubscriptionRecord = {
  id: string;
  status: "incomplete" | "active" | "past_due" | "cancelled" | "expired";
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  provider: string;
  products: { name: string } | null;
};

export type RefundRecord = {
  id: string;
  order_id: string;
  amount_minor: number;
  reason: string;
  status: "requested" | "approved" | "rejected" | "processed" | "failed";
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  orders?: { order_number: string; user_id: string } | null;
};

export type InvoiceDetail = {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  tax_note: string;
  buyer_gstin: string | null;
  place_of_supply: string | null;
  issued_at: string | null;
  orders: {
    order_number: string;
    placed_at: string | null;
    order_items: { id: string; product_name: string; quantity: number; total_minor: number }[];
  } | null;
};

export type NotificationRecord = {
  id: string;
  template: string;
  subject: string;
  body: string;
  status: "queued" | "sent" | "failed" | "cancelled" | "dead_letter";
  attempts: number;
  last_error: string | null;
  scheduled_for: string;
  sent_at: string | null;
  to_email: string;
  created_at: string;
};

export const NOTIFICATION_LABELS: Record<string, string> = {
  purchase_confirmation: "Purchase confirmation",
  payment_failure: "Payment failure",
  refund_status: "Refund status",
  exam_reminder: "Exam reminder",
  result_available: "Result available",
};
