import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UpiCheckoutSession = {
  orderId: string;
  orderNumber: string;
  status: string;
  regularSubtotalMinor: number;
  promotionDiscountMinor: number;
  couponDiscountMinor: number;
  discountMinor: number;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  promotionName: string | null;
  couponCode: string | null;
  expiresAt: string | null;
  qrImageUrl: string | null;
  upiLink: string | null;
  configured: boolean;
};

const TTL_MINUTES = 15;

/**
 * Creates (or resumes) a pending UPI order and returns the payment session.
 *
 * Nothing here grants access: the order is `pending_payment` and the
 * entitlement is only created later by the verified webhook. The payable
 * amount — including any live promotion or coupon — is calculated by the
 * database; the browser cannot influence it.
 */
export const startUpiCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { productId: string; couponCode?: string }) => {
    if (!input?.productId) throw new Error("A product is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<UpiCheckoutSession> => {
    const coupon = data.couponCode?.trim();
    const { data: order, error } = await context.supabase.rpc("create_upi_order", {
      _product_id: data.productId,
      _ttl_minutes: TTL_MINUTES,
      ...(coupon ? { _coupon_code: coupon } : {}),
    });
    if (error) throw error;
    const created = order as unknown as { id: string };

    return buildSession(created.id, context.userId);
  });

/** Re-reads the stored session for an order the caller owns. */
export const getUpiCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string }) => {
    if (!input?.orderId) throw new Error("An order is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<UpiCheckoutSession> =>
    buildSession(data.orderId, context.userId),
  );

async function buildSession(orderId: string, userId: string): Promise<UpiCheckoutSession> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { readRazorpayConfig, createUpiCharge } = await import("./razorpay.server");

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select(
      "id, user_id, order_number, status, subtotal_minor, discount_minor, tax_minor, total_minor, regular_subtotal_minor, promotion_discount_minor, coupon_discount_minor, price_promotions(name), coupons(code)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!order || order.user_id !== userId) throw new Error("Order not found");

  const { data: attempt } = await supabaseAdmin
    .from("payment_attempts")
    .select("id, status, provider_reference, expires_at, metadata")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = (attempt?.metadata ?? {}) as Record<string, unknown>;
  const promotion = order.price_promotions as { name: string } | null;
  const coupon = order.coupons as { code: string } | null;
  const base: UpiCheckoutSession = {
    orderId: order.id,
    orderNumber: order.order_number,
    status: order.status,
    regularSubtotalMinor: order.regular_subtotal_minor,
    promotionDiscountMinor: order.promotion_discount_minor,
    couponDiscountMinor: order.coupon_discount_minor,
    discountMinor: order.discount_minor,
    subtotalMinor: order.subtotal_minor,
    taxMinor: order.tax_minor,
    totalMinor: order.total_minor,
    promotionName: promotion?.name ?? null,
    couponCode: coupon?.code ?? null,
    expiresAt: attempt?.expires_at ?? null,
    qrImageUrl: (metadata["qr_image_url"] as string | undefined) ?? null,
    upiLink: (metadata["upi_link"] as string | undefined) ?? null,
    configured: true,
  };

  // Already has a QR, or the order is no longer payable — return what we have.
  if (base.qrImageUrl || order.status !== "pending_payment") return base;

  const config = readRazorpayConfig();
  if (!config) return { ...base, configured: false };

  const expiresAt = attempt?.expires_at
    ? new Date(attempt.expires_at)
    : new Date(Date.now() + TTL_MINUTES * 60_000);

  const charge = await createUpiCharge({
    config,
    orderId: order.id,
    orderNumber: order.order_number,
    amountMinor: order.total_minor,
    expiresAtSeconds: Math.floor(expiresAt.getTime() / 1000),
    description: `AskMeExam order ${order.order_number}`,
  });

  await supabaseAdmin.rpc("attach_upi_payment_reference", {
    _order_id: order.id,
    _reference: charge.qrCodeId,
    _metadata: {
      qr_code_id: charge.qrCodeId,
      qr_image_url: charge.qrImageUrl,
      upi_link: charge.upiLink,
      payment_link_id: charge.paymentLinkId,
      channel: "upi",
    },
  });

  return {
    ...base,
    qrImageUrl: charge.qrImageUrl,
    upiLink: charge.upiLink,
    expiresAt: expiresAt.toISOString(),
  };
}
