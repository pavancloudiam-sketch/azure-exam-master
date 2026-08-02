/**
 * Shared HMAC signing for outbound webhooks.
 *
 * Used by both the "send test event" server function and the background queue
 * worker so that live deliveries and test deliveries are signed identically.
 */
export async function signWebhookBody(
  secret: string,
  body: string,
  timestampSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const timestamp = timestampSeconds.toString();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return `t=${timestamp},v1=${Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Header set sent with every outbound webhook delivery. */
export function webhookHeaders(
  signature: string,
  eventType: string,
  idempotencyKey: string,
): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-askmeexam-signature": signature,
    "x-askmeexam-event": eventType,
    "x-askmeexam-idempotency-key": idempotencyKey,
  };
}
