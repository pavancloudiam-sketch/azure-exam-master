import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends a signed test event to one of the caller's own webhook endpoints.
 *
 * Authorisation is re-checked server-side with `is_org_admin` as the signed-in
 * user, so an organisation admin can only reach their own tenant's endpoint.
 * The signing secret is read with the service-role client after that check and
 * never leaves the server. Delivery is idempotent: re-sending the same
 * idempotency key reuses the stored event instead of creating a new one.
 */
export const sendTestWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { webhookId: string }) => {
    if (!input?.webhookId) throw new Error("A webhook id is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: hook } = await supabaseAdmin
      .from("organization_webhooks")
      .select("id, organization_id, target_url, secret, status")
      .eq("id", data.webhookId)
      .maybeSingle();
    if (!hook) throw new Error("Webhook endpoint not found");

    const { data: isAdmin } = await context.supabase.rpc("is_org_admin", {
      _org_id: hook.organization_id,
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("You do not manage this organisation");
    if (hook.status !== "active") throw new Error("This endpoint is disabled");

    const idempotencyKey = `test:${hook.id}:${Date.now()}`;
    const { data: eventId, error: eventError } = await context.supabase.rpc(
      "enqueue_webhook_event",
      {
        _organization_id: hook.organization_id,
        _event_type: "webhook.test",
        _idempotency_key: idempotencyKey,
        _payload: { message: "AskMeExam test event", sent_at: new Date().toISOString() },
      },
    );
    if (eventError) throw eventError;

    const body = JSON.stringify({
      id: eventId,
      type: "webhook.test",
      organization_id: hook.organization_id,
      created_at: new Date().toISOString(),
      data: { message: "AskMeExam test event" },
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(hook.secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${timestamp}.${body}`),
    );
    const signature = `t=${timestamp},v1=${Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;

    let status = "failed";
    let responseStatus: number | null = null;
    let lastError: string | null = null;
    try {
      const response = await fetch(hook.target_url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-askmeexam-signature": signature,
          "x-askmeexam-event": "webhook.test",
          "x-askmeexam-idempotency-key": idempotencyKey,
        },
        body,
      });
      responseStatus = response.status;
      status = response.ok ? "delivered" : "failed";
      if (!response.ok) lastError = `Endpoint responded with ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Delivery failed";
    }

    await supabaseAdmin.from("webhook_deliveries").insert({
      webhook_id: hook.id,
      organization_id: hook.organization_id,
      event_id: eventId as unknown as string,
      status,
      attempts: 1,
      signature,
      response_status: responseStatus,
      last_error: lastError,
      delivered_at: status === "delivered" ? new Date().toISOString() : null,
    });

    await supabaseAdmin
      .from("organization_webhooks")
      .update({ last_delivery_at: new Date().toISOString(), last_delivery_status: status })
      .eq("id", hook.id);

    return { status, responseStatus, error: lastError };
  });