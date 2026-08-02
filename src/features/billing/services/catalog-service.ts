import { supabase } from "@/integrations/supabase/client";
import type { CatalogProduct, EntitlementRecord, PurchaseRecord } from "../types";

/**
 * Public catalogue read. Prices and products are the only commercial tables a
 * visitor can see; every order-side table is owner-scoped by RLS.
 */
export async function listCatalog(): Promise<CatalogProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, code, name, description, product_type, access_scope, access_days, sort_order, prices(id, currency, amount_minor, billing_interval, interval_count)",
    )
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as CatalogProduct[];
}

export async function listMyPurchases(): Promise<PurchaseRecord[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, currency, total_minor, placed_at, created_at, order_items(id, product_name, quantity, total_minor), invoices(id, invoice_number, status, issued_at), refunds(id, amount_minor, status, created_at)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as PurchaseRecord[];
}

export async function listMyEntitlements(): Promise<EntitlementRecord[]> {
  const { data, error } = await supabase
    .from("entitlements")
    .select("id, access_scope, source, status, starts_at, expires_at, products(name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as EntitlementRecord[];
}