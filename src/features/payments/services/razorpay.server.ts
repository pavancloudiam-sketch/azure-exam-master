/**
 * Razorpay UPI helpers. Server-only: the key secret and webhook secret never
 * leave this module, and no browser bundle may import it (`.server` filename
 * is blocked by the template's import protection).
 *
 * The provider is isolated behind this file on purpose — adding cards, net
 * banking or another gateway later means adding a sibling module, not touching
 * the order / entitlement business logic in the database.
 */

const API = "https://api.razorpay.com/v1";

export type RazorpayConfig = { keyId: string; keySecret: string };

/** Reads credentials at call time (env is injected per request on the edge). */
export function readRazorpayConfig(): RazorpayConfig | null {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function readWebhookSecret(): string | null {
  return process.env["RAZORPAY_WEBHOOK_SECRET"] ?? null;
}

function authHeader({ keyId, keySecret }: RazorpayConfig) {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

async function call<T>(config: RazorpayConfig, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { authorization: authHeader(config), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Razorpay request failed [${response.status}]: ${text}`);
  }
  return JSON.parse(text) as T;
}

export type UpiCharge = {
  qrCodeId: string;
  qrImageUrl: string;
  upiLink: string | null;
  paymentLinkId: string | null;
};

/**
 * Creates a single-use UPI QR plus a tappable UPI payment link for the same
 * order. `notes.order_id` is the only join key we rely on when the webhook
 * comes back, so it must be set on both objects.
 */
export async function createUpiCharge(input: {
  config: RazorpayConfig;
  orderId: string;
  orderNumber: string;
  amountMinor: number;
  expiresAtSeconds: number;
  description: string;
  customerEmail?: string | null;
}): Promise<UpiCharge> {
  const notes = { order_id: input.orderId, order_number: input.orderNumber };

  const qr = await call<{ id: string; image_url: string }>(input.config, "/payments/qr_codes", {
    type: "upi_qr",
    name: "AskMeExam",
    usage: "single_use",
    fixed_amount: true,
    payment_amount: input.amountMinor,
    description: input.description,
    close_by: input.expiresAtSeconds,
    notes,
  });

  let upiLink: string | null = null;
  let paymentLinkId: string | null = null;
  try {
    const link = await call<{ id: string; short_url: string }>(input.config, "/payment_links", {
      amount: input.amountMinor,
      currency: "INR",
      accept_partial: false,
      description: input.description,
      upi_link: true,
      expire_by: input.expiresAtSeconds,
      reference_id: input.orderNumber,
      notify: { sms: false, email: false },
      notes,
    });
    upiLink = link.short_url;
    paymentLinkId = link.id;
  } catch {
    // The QR alone is enough to complete the payment; a link failure is not fatal.
    upiLink = null;
  }

  return { qrCodeId: qr.id, qrImageUrl: qr.image_url, upiLink, paymentLinkId };
}

export async function closeUpiQr(config: RazorpayConfig, qrCodeId: string): Promise<void> {
  try {
    await call(config, `/payments/qr_codes/${qrCodeId}/close`, {});
  } catch {
    // Closing is best-effort; the QR also expires on its own `close_by`.
  }
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Razorpay signs the raw request body with HMAC-SHA256 of the webhook secret. */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return timingSafeEqual(toHex(mac), signature.trim().toLowerCase());
}
