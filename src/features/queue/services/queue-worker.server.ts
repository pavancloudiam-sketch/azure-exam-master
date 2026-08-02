import { buildBrandedEmail } from "@/features/organizations/services/branding-email";
import type { OrganizationBranding } from "@/features/organizations/types";
import { signWebhookBody, webhookHeaders } from "@/features/enterprise/services/webhook-signature";

import {
  PermanentEmailError,
  defaultFromAddress,
  resolveEmailProvider,
} from "./email-provider.server";

export type QueueRunSummary = {
  emails: { claimed: number; sent: number; retried: number; deadLettered: number };
  webhooks: { claimed: number; delivered: number; retried: number; deadLettered: number };
  retention: { status: string };
  duration_ms: number;
};

function log(code: string, message: string, context: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      severity: "info",
      code,
      message,
      source: "server",
      context,
    }),
  );
}

/**
 * Drains both queues once.
 *
 * Everything transactional lives in the database: `claim_*_jobs` leases a bounded
 * batch with `FOR UPDATE SKIP LOCKED` (so concurrent worker runs never process the
 * same job), and `complete_*_job` records the outcome, applies exponential backoff
 * or dead-letters an exhausted job, and writes the audit row. The worker itself is
 * stateless and safe to re-run at any time.
 */
export async function runQueueWorker(batchSize = 10): Promise<QueueRunSummary> {
  const startedAt = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const summary: QueueRunSummary = {
    emails: { claimed: 0, sent: 0, retried: 0, deadLettered: 0 },
    webhooks: { claimed: 0, delivered: 0, retried: 0, deadLettered: 0 },
    duration_ms: 0,
  };

  // ---------------------------------------------------------------- emails
  const { data: emailJobs, error: emailClaimError } = await supabaseAdmin.rpc("claim_email_jobs", {
    _limit: batchSize,
    _lease_seconds: 120,
  });
  if (emailClaimError) throw emailClaimError;

  const provider = resolveEmailProvider();
  const fromAddress = defaultFromAddress();
  const brandingCache = new Map<string, OrganizationBranding | null>();

  for (const job of emailJobs ?? []) {
    summary.emails.claimed += 1;
    let failure: string | null = null;

    try {
      // Tenant branding, when the recipient belongs to an organisation.
      let branding: OrganizationBranding | null = null;
      const { data: membership } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", job.user_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      const orgId = membership?.organization_id ?? null;
      if (orgId) {
        if (!brandingCache.has(orgId)) {
          const { data } = await supabaseAdmin
            .from("organization_branding")
            .select("*")
            .eq("organization_id", orgId)
            .maybeSingle();
          brandingCache.set(orgId, (data as OrganizationBranding | null) ?? null);
        }
        branding = brandingCache.get(orgId) ?? null;
      }

      const rendered = buildBrandedEmail(branding, job.subject, job.body);
      await provider.send({
        to: job.to_email,
        fromName: rendered.fromName,
        fromAddress,
        replyTo: rendered.replyTo,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        idempotencyKey: job.idempotency_key,
      });
    } catch (cause) {
      failure =
        cause instanceof PermanentEmailError
          ? `permanent: ${cause.message}`
          : cause instanceof Error
            ? cause.message
            : "Unknown send failure";
    }

    const { data: completed, error: completeError } = await supabaseAdmin.rpc(
      "complete_email_job",
      failure === null ? { _id: job.id } : { _id: job.id, _error: failure },
    );
    if (completeError) throw completeError;
    const status = (completed as { status?: string } | null)?.status;
    if (status === "sent") summary.emails.sent += 1;
    else if (status === "dead_letter") summary.emails.deadLettered += 1;
    else summary.emails.retried += 1;
  }

  // -------------------------------------------------------------- webhooks
  const { data: hookJobs, error: hookClaimError } = await supabaseAdmin.rpc("claim_webhook_jobs", {
    _limit: batchSize,
    _lease_seconds: 120,
  });
  if (hookClaimError) throw hookClaimError;

  for (const job of hookJobs ?? []) {
    summary.webhooks.claimed += 1;

    const body = JSON.stringify({
      id: job.event_id,
      type: job.event_type,
      organization_id: job.organization_id,
      created_at: job.event_created_at,
      data: job.payload,
    });
    const signature = await signWebhookBody(job.secret, body);

    let responseStatus: number | null = null;
    let failure: string | null = null;
    try {
      const response = await fetch(job.target_url, {
        method: "POST",
        headers: webhookHeaders(signature, job.event_type, job.idempotency_key),
        body,
        signal: AbortSignal.timeout(10_000),
      });
      responseStatus = response.status;
      if (!response.ok) failure = `Endpoint responded with ${response.status}`;
    } catch (cause) {
      failure = cause instanceof Error ? cause.message : "Delivery failed";
    }

    const { data: completed, error: completeError } = await supabaseAdmin.rpc(
      "complete_webhook_job",
      {
        _delivery_id: job.delivery_id,
        _signature: signature,
        ...(responseStatus === null ? {} : { _response_status: responseStatus }),
        ...(failure === null ? {} : { _error: failure }),
      },
    );
    if (completeError) throw completeError;
    const status = (completed as { status?: string } | null)?.status;
    if (status === "delivered") summary.webhooks.delivered += 1;
    else if (status === "dead_letter") summary.webhooks.deadLettered += 1;
    else summary.webhooks.retried += 1;
  }

  summary.duration_ms = Date.now() - startedAt;
  log("queue.run_completed", "Queue worker run finished", {
    provider: provider.name,
    emails_claimed: summary.emails.claimed,
    emails_sent: summary.emails.sent,
    emails_dead_lettered: summary.emails.deadLettered,
    webhooks_claimed: summary.webhooks.claimed,
    webhooks_delivered: summary.webhooks.delivered,
    webhooks_dead_lettered: summary.webhooks.deadLettered,
    duration_ms: summary.duration_ms,
  });

  return summary;
}
