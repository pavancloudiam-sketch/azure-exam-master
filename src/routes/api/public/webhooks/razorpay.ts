import { createFileRoute } from "@tanstack/react-router";

/**
 * Razorpay webhook — the ONLY thing that can mark a payment successful.
 *
 * Public prefix (edge auth bypassed), so every request is authenticated here by
 * verifying the `x-razorpay-signature` HMAC over the raw body. Deliveries are
 * de-duplicated on the provider event id, so a retry or a replay of an already
 * processed event is recorded and ignored instead of granting access twice.
 */

type RazorpayEntity = {
  id?: string;
  status?: string;
  error_code?: string;
  error_description?: string;
  method?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, string>;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function extract(payload: Record<string, unknown>) {
  const container = payload["payload"] as Record<string, { entity?: RazorpayEntity }> | undefined;
  const payment = container?.["payment"]?.entity;
  const qr = container?.["qr_code"]?.entity;
  const link = container?.["payment_link"]?.entity;
  const entity = payment ?? link ?? qr;
  const orderId =
    payment?.notes?.["order_id"] ?? link?.notes?.["order_id"] ?? qr?.notes?.["order_id"] ?? null;
  return {
    entity,
    orderId,
    reference: payment?.id ?? link?.id ?? qr?.id ?? null,
    // Amount/currency as reported by the provider. The database refuses to
    // settle when these disagree with the server-calculated order total.
    amountMinor: payment?.amount ?? link?.amount ?? qr?.amount ?? null,
    currency: payment?.currency ?? link?.currency ?? qr?.currency ?? null,
  };
}

export const Route = createFileRoute("/api/public/webhooks/razorpay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return json({ error: "webhook_not_configured" }, 503);

        const rawBody = await request.text();
        const { verifyWebhookSignature } = await import(
          "@/features/payments/services/razorpay.server"
        );
        const valid = await verifyWebhookSignature(
          rawBody,
          request.headers.get("x-razorpay-signature"),
          secret,
        );
        if (!valid) return json({ error: "invalid_signature" }, 401);

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          return json({ error: "invalid_payload" }, 400);
        }

        const eventType = String(payload["event"] ?? "unknown");
        const eventId =
          request.headers.get("x-razorpay-event-id") ??
          `${eventType}:${String(payload["created_at"] ?? Date.now())}`;
        const { entity, orderId, reference } = extract(payload);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Store the smallest useful footprint: never card data, never raw contact details.
        const trimmed = {
          event: eventType,
          reference,
          method: entity?.method ?? null,
          status: entity?.status ?? null,
        };

        const { data: isNew, error: recordError } = await supabaseAdmin.rpc(
          "record_payment_webhook",
          {
            _event_id: eventId,
            _event_type: eventType,
            _order_id: orderId as unknown as string,
            _payload: trimmed,
            _provider: "razorpay",
          },
        );
        if (recordError) return json({ error: "record_failed" }, 500);
        if (!isNew) return json({ status: "duplicate_ignored" });

        try {
          if (!orderId) {
            await supabaseAdmin.rpc("complete_payment_webhook", {
              _event_id: eventId,
              _status: "ignored",
              _error: "No order reference on the event",
            });
            return json({ status: "ignored" });
          }

          if (
            eventType === "payment.captured" ||
            eventType === "qr_code.credited" ||
            eventType === "payment_link.paid"
          ) {
            const { error } = await supabaseAdmin.rpc("settle_upi_payment", {
              _order_id: orderId,
              _provider_reference: reference ?? eventId,
              _method: entity?.method ?? "upi",
              _payload: trimmed,
            });
            if (error) throw error;
          } else if (eventType === "payment.failed") {
            const { error } = await supabaseAdmin.rpc("fail_upi_payment", {
              _order_id: orderId,
              _provider_reference: reference ?? eventId,
              _code: entity?.error_code ?? "payment_failed",
              _message: entity?.error_description ?? "The UPI payment was not completed.",
            });
            if (error) throw error;
          } else {
            await supabaseAdmin.rpc("complete_payment_webhook", {
              _event_id: eventId,
              _status: "ignored",
            });
            return json({ status: "ignored" });
          }

          await supabaseAdmin.rpc("complete_payment_webhook", {
            _event_id: eventId,
            _status: "processed",
          });
          return json({ status: "processed" });
        } catch (cause) {
          await supabaseAdmin.rpc("complete_payment_webhook", {
            _event_id: eventId,
            _status: "error",
            _error: cause instanceof Error ? cause.message : "Unknown error",
          });
          // A 500 makes Razorpay retry; the dedupe key keeps the retry safe.
          return json({ error: "processing_failed" }, 500);
        }
      },
    },
  },
});
