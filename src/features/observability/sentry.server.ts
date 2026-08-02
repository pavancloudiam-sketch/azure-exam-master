/**
 * Minimal, dependency-free Sentry transport.
 *
 * It speaks the Sentry envelope HTTP API directly with `fetch`, which keeps the
 * Worker bundle free of a Node-oriented SDK and means monitoring can be turned
 * on or off purely by configuration. Sentry is *optional*: with no `SENTRY_DSN`
 * the app behaves exactly as before and every event still goes to the
 * structured log.
 *
 * This module never invents its own log shape — callers hand it an already
 * redacted `LogEvent`-style record built by the existing observability layer.
 */
import { redactContext, redactText } from "./redact";

type ParsedDsn = { url: string; publicKey: string };

let cachedDsn: ParsedDsn | null | undefined;

/** `https://<publicKey>@<host>/<projectId>` → envelope endpoint. */
function parseDsn(): ParsedDsn | null {
  if (cachedDsn !== undefined) return cachedDsn;
  const raw = process.env["SENTRY_DSN"];
  if (!raw) {
    cachedDsn = null;
    return null;
  }
  try {
    const parsed = new URL(raw);
    const projectId = parsed.pathname.replaceAll("/", "");
    if (!parsed.username || !projectId) throw new Error("incomplete dsn");
    cachedDsn = {
      publicKey: parsed.username,
      url: `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`,
    };
  } catch {
    // A malformed DSN must never break a request path; log once and stay off.
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        severity: "warn",
        code: "monitor.disabled",
        message: "SENTRY_DSN is set but could not be parsed; Sentry reporting is disabled",
        source: "server",
      }),
    );
    cachedDsn = null;
  }
  return cachedDsn;
}

export function isSentryEnabled(): boolean {
  return parseDsn() !== null;
}

export type SentryEvent = {
  code: string;
  message: string;
  severity: "info" | "warn" | "error" | "fatal";
  /** Ties the report to the browser session that produced it. */
  correlationId?: string | undefined;
  /** The reference shown to the user on error screens. */
  requestId?: string | undefined;
  route?: string | undefined;
  source?: "client" | "server" | "cron";
  context?: Record<string, unknown> | undefined;
  errorName?: string | undefined;
};

function eventId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replaceAll("-", "");
}

/**
 * Sends one event. Fire-and-forget by contract: a monitoring outage must never
 * turn into an application outage, so failures are swallowed after a log line.
 */
export async function captureToSentry(event: SentryEvent): Promise<boolean> {
  const dsn = parseDsn();
  if (!dsn) return false;

  const environment = process.env["SENTRY_ENVIRONMENT"] ?? process.env["NODE_ENV"] ?? "production";
  const release = process.env["SENTRY_RELEASE"];
  const context = redactContext(event.context) ?? {};
  const message = redactText(event.message);

  const payload = {
    event_id: eventId(),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    logger: "askmeexam",
    level: event.severity === "warn" ? "warning" : event.severity,
    environment,
    ...(release ? { release } : {}),
    message: { formatted: message },
    transaction: event.route,
    tags: {
      code: event.code,
      source: event.source ?? "server",
      ...(event.correlationId ? { correlation_id: event.correlationId } : {}),
      ...(event.requestId ? { request_id: event.requestId } : {}),
      ...(event.errorName ? { error_name: event.errorName } : {}),
    },
    extra: context,
    ...(event.errorName
      ? { exception: { values: [{ type: event.errorName, value: message }] } }
      : {}),
  };

  const body = [
    JSON.stringify({ event_id: payload.event_id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(payload),
  ].join("\n");

  try {
    const response = await fetch(dsn.url, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
        // The DSN public key is not a secret, but it is still only ever sent to
        // Sentry — it is never logged or returned to a caller.
        "x-sentry-auth": `Sentry sentry_version=7, sentry_client=askmeexam/1.0, sentry_key=${dsn.publicKey}`,
      },
      body,
    });
    return response.ok;
  } catch {
    return false;
  }
}
