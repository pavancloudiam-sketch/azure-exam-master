/**
 * Observability event vocabulary.
 *
 * Every logged event uses one of these codes so that operational metrics can
 * be derived by counting codes rather than by parsing free text.
 */
export const EVENT_CODES = [
  "auth.login_failed",
  "auth.oauth_failed",
  "auth.register_failed",
  "auth.password_reset_failed",
  "auth.session_expired",
  "authz.denied",
  "attempt.autosave_failed",
  "attempt.load_failed",
  "attempt.submit_failed",
  "attempt.scoring_failed",
  "import.parse_failed",
  "import.stage_failed",
  "import.duplicate_scan_failed",
  "import.attestation_failed",
  "db.query_failed",
  "ui.unhandled_error",
  "server.unexpected_error",
  "health.check_failed",
] as const;

export type EventCode = (typeof EVENT_CODES)[number];

export type Severity = "info" | "warn" | "error";

/** Structured log record. Field names are stable — dashboards depend on them. */
export type LogEvent = {
  /** ISO-8601, set by the emitter. */
  timestamp: string;
  severity: Severity;
  code: EventCode;
  /** Short, non-sensitive human summary. Never interpolate user input. */
  message: string;
  /** Stable per browser session — ties a user's events together. */
  correlation_id: string;
  /** Unique per logged operation. Shown to the user on error screens. */
  request_id: string;
  /** Route path only; query strings are dropped (they can carry redirects). */
  route?: string;
  /** Opaque identifiers only (attempt id, batch id, http status, …). */
  context?: Record<string, string | number | boolean | null>;
};
