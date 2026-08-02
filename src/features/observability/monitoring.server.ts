/**
 * Server-side reporting bridge.
 *
 * The structured log defined in `logger.ts` / `types.ts` stays the single
 * source of truth: every server event is still emitted as one JSON line with
 * the same field names. This module only *forwards* those already-redacted
 * records to Sentry when a DSN is configured, and raises operational alerts
 * for background failures (cron runs, queue dead letters) that no user is
 * present to see.
 */
import { captureToSentry, isSentryEnabled } from "./sentry.server";
import { redactContext, redactText } from "./redact";
import type { EventCode, Severity } from "./types";

export type ServerEventInput = {
  code: EventCode;
  message: string;
  severity?: Severity;
  /** Ties background work back to the request/session that queued it. */
  correlationId?: string | undefined;
  requestId?: string | undefined;
  route?: string | undefined;
  source?: "client" | "server" | "cron";
  context?: Record<string, unknown> | undefined;
  cause?: unknown;
};

function errorName(cause: unknown): string | undefined {
  if (cause && typeof cause === "object" && typeof (cause as Error).name === "string") {
    return (cause as Error).name;
  }
  return cause === undefined ? undefined : typeof cause;
}

function errorMessage(cause: unknown): string | undefined {
  if (cause && typeof cause === "object" && typeof (cause as Error).message === "string") {
    return redactText((cause as Error).message);
  }
  return undefined;
}

/**
 * Emits one structured server log line and, if monitoring is enabled, mirrors
 * it to Sentry. Awaiting is optional — callers on a hot path may ignore the
 * promise; the transport never throws.
 */
export async function reportServerEvent(input: ServerEventInput): Promise<void> {
  const severity = input.severity ?? "error";
  const source = input.source ?? "server";
  const context = {
    ...(redactContext(input.context) ?? {}),
    ...(input.cause !== undefined
      ? { error_name: errorName(input.cause), error_message: errorMessage(input.cause) }
      : {}),
  };

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    severity,
    code: input.code,
    message: redactText(input.message),
    source,
    ...(input.correlationId ? { correlation_id: input.correlationId } : {}),
    ...(input.requestId ? { request_id: input.requestId } : {}),
    ...(input.route ? { route: input.route } : {}),
    context,
  });
  if (severity === "error") console.error(line);
  else if (severity === "warn") console.warn(line);
  else console.info(line);

  if (!isSentryEnabled() || severity === "info") return;
  await captureToSentry({
    code: input.code,
    message: input.message,
    severity,
    correlationId: input.correlationId,
    requestId: input.requestId,
    route: input.route,
    source,
    context,
    errorName: errorName(input.cause),
  });
}

/**
 * Operational alert for unattended failures (cron, queue). Alerts are ordinary
 * error events tagged `alert=true` so a Sentry alert rule can select them
 * without a second delivery channel.
 */
export async function raiseOpsAlert(input: {
  code: EventCode;
  message: string;
  context?: Record<string, unknown>;
  cause?: unknown;
  correlationId?: string | undefined;
}): Promise<void> {
  await reportServerEvent({
    ...input,
    severity: "error",
    source: "cron",
    context: { ...(input.context ?? {}), alert: true },
  });
}

/** Threshold above which dead-lettered jobs in one run raise an alert. */
export function deadLetterAlertThreshold(): number {
  const raw = Number(process.env["MONITOR_DEAD_LETTER_THRESHOLD"] ?? "1");
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}
