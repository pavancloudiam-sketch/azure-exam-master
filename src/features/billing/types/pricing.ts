/** Server-calculated pricing shapes. Amounts are always paise (INR minor units). */

export type EffectivePrice = {
  product_id: string;
  price_id: string | null;
  currency: string;
  regular_minor: number;
  final_minor: number;
  promotion_id: string | null;
  promotion_name: string | null;
  promotion_minor: number | null;
  promotion_discount_minor: number;
  promotion_active: boolean;
  promotion_starts_at: string | null;
  promotion_ends_at: string | null;
  upcoming_promotion_starts_at: string | null;
  allow_coupon_stacking: boolean;
  time_zone: string;
  server_now: string;
};

export type PublicPricingRow = {
  product_id: string;
  code: string;
  name: string;
  description: string | null;
  product_type: string;
  access_scope: string;
  access_days: number | null;
  sort_order: number;
  billing_interval: string | null;
  interval_count: number;
  pricing: EffectivePrice;
};

export type PurchaseQuote = {
  product_id: string;
  currency: string;
  regular_minor: number;
  promotion_discount_minor: number;
  coupon_discount_minor: number;
  total_discount_minor: number;
  final_minor: number;
  promotion_id: string | null;
  promotion_name: string | null;
  promotion_active: boolean;
  promotion_ends_at: string | null;
  coupon_id: string | null;
  coupon_code: string | null;
  coupon_applied: boolean;
  coupon_message: string | null;
  pricing_source: "promotion" | "coupon" | "regular";
};

export type PromotionRecord = {
  id: string;
  product_id: string;
  name: string;
  description: string | null;
  currency: string;
  promo_amount_minor: number;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  is_active: boolean;
  allow_coupon_stacking: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
  products: { name: string } | null;
};

export type PromotionReportRow = {
  promotion_id: string;
  name: string;
  product_id: string;
  product_name: string;
  promo_amount_minor: number;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  is_active: boolean;
  allow_coupon_stacking: boolean;
  priority: number;
  paid_orders: number;
  pending_orders: number;
  expired_orders: number;
  students: number;
  gross_minor: number;
  discount_minor: number;
  collected_minor: number;
};

export type SalesSummary = {
  regular_orders: number;
  promotional_orders: number;
  gross_minor: number;
  promotional_discount_minor: number;
  coupon_discount_minor: number;
  collected_minor: number;
  pending_promotional_orders: number;
  expired_promotional_orders: number;
};

export type PromotionStatus = "Draft" | "Scheduled" | "Active" | "Expired" | "Disabled";

/**
 * Status derived from the promotion row plus a *server* timestamp. The caller
 * must pass the clock reported by the database, never `new Date()` alone.
 */
export function promotionStatus(
  promo: { is_active: boolean; starts_at: string; ends_at: string },
  serverNow: Date,
): PromotionStatus {
  const start = new Date(promo.starts_at).getTime();
  const end = new Date(promo.ends_at).getTime();
  const now = serverNow.getTime();
  if (!promo.is_active) return now < start ? "Draft" : now > end ? "Expired" : "Disabled";
  if (now < start) return "Scheduled";
  if (now > end) return "Expired";
  return "Active";
}


export type OfferCountdown = {
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
  label: string;
};

/**
 * Human countdown to the end of an offer. Purely presentational — the server
 * remains the only authority on whether an offer is still active.
 */
export function offerCountdown(endsAt: string | null, now: Date = new Date()): OfferCountdown {
  if (!endsAt) return { expired: true, days: 0, hours: 0, minutes: 0, label: "" };
  const ms = new Date(endsAt).getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) {
    return { expired: true, days: 0, hours: 0, minutes: 0, label: "Offer ended" };
  }
  const minutesTotal = Math.floor(ms / 60_000);
  const days = Math.floor(minutesTotal / (60 * 24));
  const hours = Math.floor((minutesTotal % (60 * 24)) / 60);
  const minutes = minutesTotal % 60;
  const label =
    days > 0
      ? `${days} day${days === 1 ? "" : "s"} ${hours} hr left`
      : hours > 0
        ? `${hours} hr ${minutes} min left`
        : `${minutes} min left`;
  return { expired: false, days, hours, minutes, label };
}

/** Formats the offer end date in the promotion's own time zone. */
export function formatOfferEnd(endsAt: string | null, timeZone = "Asia/Kolkata"): string {
  if (!endsAt) return "";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(endsAt));
}
