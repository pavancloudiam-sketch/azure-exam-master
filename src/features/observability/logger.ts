import { getCorrelationId, newRequestId } from "./correlation";
import { redactContext, redactRoute, redactText } from "./redact";
import type { EventCode, LogEvent, Severity } from "./types";

const TELEMETRY_ENDPOINT = "/api/public/telemetry";
/** Guards against a render loop turning into a log flood. */
const MAX_EVENTS_PER_SESSION = 100;
let sentCount = 0;

function currentRoute(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return redactRoute(window.location.pathname);
}

/**
 * Emits one structured event: to the browser console for local debugging and,
 * fire-and-forget, to the server so it lands in the structured server log.
 * Returns the request id so callers can show it to the user.
 */
export function logEvent(input: {
  code: EventCode;
  message: string;
  severity?: Severity;
  context?: Record<string, unknown>;
  requestId?: string;
}): string {
  const requestId = input.requestId ?? newRequestId();
  const event: LogEvent = {
    timestamp: new Date().toISOString(),
    severity: input.severity ?? "error",
    code: input.code,
    message: redactText(input.message),
    correlation_id: getCorrelationId(),
    request_id: requestId,
    ...(currentRoute() ? { route: currentRoute()! } : {}),
    ...(redactContext(input.context) ? { context: redactContext(input.context)! } : {}),
  };

  if (event.severity === "error") console.error("[askmeexam]", event);
  else if (event.severity === "warn") console.warn("[askmeexam]", event);
  else console.info("[askmeexam]", event);

  if (typeof window !== "undefined" && sentCount < MAX_EVENTS_PER_SESSION) {
    sentCount += 1;
    void fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "x-request-id": requestId },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      // Telemetry must never break the feature it is observing.
    });
  }

  return requestId;
}

/**
 * Extracts only non-sensitive diagnostics from a thrown value: the error name,
 * a redacted message, and any HTTP/Postgres status codes. The original object
 * (which may embed request bodies) is never serialised.
 */
export function errorContext(cause: unknown): Record<string, unknown> {
  if (cause && typeof cause === "object") {
    const record = cause as Record<string, unknown>;
    return {
      error_name: typeof record["name"] === "string" ? record["name"] : "Error",
      error_message:
        typeof record["message"] === "string" ? redactText(record["message"]) : undefined,
      error_code: typeof record["code"] === "string" ? record["code"] : undefined,
      http_status: typeof record["status"] === "number" ? record["status"] : undefined,
    };
  }
  return { error_name: typeof cause };
}

/** Convenience wrapper: log a caught error under an event code. */
export function logError(
  code: EventCode,
  message: string,
  cause: unknown,
  context?: Record<string, unknown>,
): string {
  return logEvent({
    code,
    message,
    severity: "error",
    context: { ...errorContext(cause), ...context },
  });
}
