import { supabase } from "@/integrations/supabase/client";
import type { EffectivePrice, PromotionRecord, PromotionReportRow, PublicPricingRow, PurchaseQuote, SalesSummary } from "../types/pricing";

/**
 * Public, server-calculated pricing. The promotional price is decided by the
 * database clock — the browser never computes or supplies an amount.
 */
export async function getPublicPricing(): Promise<PublicPricingRow[]> {
  const { data, error } = await supabase.rpc("get_public_pricing");
  if (error) throw error;
  return (data ?? []) as unknown as PublicPricingRow[];
}

export async function getEffectivePrice(productId: string): Promise<EffectivePrice> {
  const { data, error } = await supabase.rpc("get_effective_price", { _product_id: productId });
  if (error) throw error;
  return data as unknown as EffectivePrice;
}

/** Preview of what the server would charge, including coupon policy messages. */
export async function evaluatePurchasePrice(
  productId: string,
  couponCode?: string,
): Promise<PurchaseQuote> {
  const trimmed = couponCode?.trim();
  const { data, error } = await supabase.rpc("evaluate_purchase_price", {
    _product_id: productId,
    ...(trimmed ? { _coupon_code: trimmed } : {}),
  });
  if (error) throw error;
  return data as unknown as PurchaseQuote;
}

/* ------------------------------------------------------------------ admin */

export async function listPromotions(): Promise<PromotionRecord[]> {
  const { data, error } = await supabase
    .from("price_promotions")
    .select(
      "id, product_id, name, description, currency, promo_amount_minor, starts_at, ends_at, time_zone, is_active, allow_coupon_stacking, priority, created_at, updated_at, products(name)",
    )
    .order("starts_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PromotionRecord[];
}

export type PromotionInput = {
  product_id: string;
  name: string;
  description?: string | null;
  promo_amount_minor: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  allow_coupon_stacking: boolean;
  priority?: number;
};

export async function createPromotion(input: PromotionInput): Promise<void> {
  const { error } = await supabase
    .from("price_promotions")
    .insert({ ...input, time_zone: "Asia/Kolkata" });
  if (error) throw error;
}

export async function updatePromotion(id: string, input: Partial<PromotionInput>): Promise<void> {
  const { error } = await supabase.from("price_promotions").update(input).eq("id", id);
  if (error) throw error;
}

export async function setPromotionActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("price_promotions")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

export async function getPromotionReport(): Promise<PromotionReportRow[]> {
  const { data, error } = await supabase.rpc("get_promotion_report", {});
  if (error) throw error;
  return (data ?? []) as unknown as PromotionReportRow[];
}

export async function getPricingSalesSummary(): Promise<SalesSummary | null> {
  const { data, error } = await supabase.rpc("get_pricing_sales_summary");
  if (error) throw error;
  return (data ?? null) as unknown as SalesSummary | null;
}

export type AdminProductPrice = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  prices: { id: string; amount_minor: number; is_active: boolean }[];
};

export async function listProductsWithPrices(): Promise<AdminProductPrice[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, code, is_active, prices(id, amount_minor, is_active)")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as AdminProductPrice[];
}
