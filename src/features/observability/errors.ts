import { shortReference } from "./correlation";

export type FriendlyError = {
  title: string;
  /** What happened, in plain language. Never exposes internal detail. */
  message: string;
  /** What the user should do next. */
  retryGuidance: string;
  /** True when retrying the same action is likely to succeed. */
  retryable: boolean;
  /** True when the fix is to sign in again. */
  sessionExpired: boolean;
  /** Support reference derived from the request id. */
  reference?: string | undefined;
};

function rawMessage(cause: unknown): string {
  if (cause && typeof cause === "object" && typeof (cause as { message?: unknown }).message === "string") {
    return (cause as { message: string }).message;
  }
  return typeof cause === "string" ? cause : "";
}

function statusOf(cause: unknown): number | undefined {
  const status = (cause as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

export function isSessionExpired(cause: unknown): boolean {
  const message = rawMessage(cause).toLowerCase();
  return (
    statusOf(cause) === 401 ||
    message.includes("jwt expired") ||
    message.includes("invalid claim") ||
    message.includes("refresh token") ||
    message.includes("not authenticated")
  );
}

export function isAuthorizationError(cause: unknown): boolean {
  const message = rawMessage(cause).toLowerCase();
  return (
    statusOf(cause) === 403 ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("not authorised") ||
    message.includes("admin role required")
  );
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Turns any thrown value into a message safe to render. Internal detail
 * (SQL text, constraint names, stack traces) is never surfaced; the request id
 * is the bridge between what the user sees and what the log contains.
 */
export function describeError(cause: unknown, requestId?: string): FriendlyError {
  const reference = requestId ? shortReference(requestId) : undefined;
  const base = { reference };

  if (isSessionExpired(cause)) {
    return {
      ...base,
      title: "Your session has expired",
      message: "You were signed out because your session timed out.",
      retryGuidance: "Sign in again — any answers already saved are safe.",
      retryable: false,
      sessionExpired: true,
    };
  }

  if (isAuthorizationError(cause)) {
    return {
      ...base,
      title: "You don't have access to this",
      message: "Your account isn't permitted to perform that action.",
      retryGuidance: "If you think this is wrong, contact an administrator.",
      retryable: false,
      sessionExpired: false,
    };
  }

  if (isOffline() || rawMessage(cause).toLowerCase().includes("failed to fetch")) {
    return {
      ...base,
      title: "You appear to be offline",
      message: "We couldn't reach AskMeExam.",
      retryGuidance: "Check your connection and try again in a few seconds.",
      retryable: true,
      sessionExpired: false,
    };
  }

  const status = statusOf(cause);
  if (status === 429) {
    return {
      ...base,
      title: "Too many requests",
      message: "The service is busy handling your requests.",
      retryGuidance: "Wait about a minute, then try again.",
      retryable: true,
      sessionExpired: false,
    };
  }

  return {
    ...base,
    title: "Something went wrong",
    message: "We couldn't complete that action.",
    retryGuidance: "Try again. If it keeps happening, contact support with the reference below.",
    retryable: true,
    sessionExpired: false,
  };
}

/** One-line version for toasts. */
export function errorToastMessage(cause: unknown, requestId?: string): string {
  const described = describeError(cause, requestId);
  return described.reference
    ? `${described.message} ${described.retryGuidance} (ref ${described.reference})`
    : `${described.message} ${described.retryGuidance}`;
}
