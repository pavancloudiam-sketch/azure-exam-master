import { Link } from "@tanstack/react-router";

import type { FriendlyError } from "../errors";

/**
 * Safe fallback screen. Renders only the friendly description — never the
 * underlying error message, which can contain query text or identifiers.
 */
export function ErrorFallback({
  error,
  onRetry,
  compact = false,
}: {
  error: FriendlyError;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      role="alert"
      className={
        compact
          ? "rounded-lg border border-border bg-card p-6"
          : "flex min-h-[60vh] flex-1 items-center justify-center px-6 py-12"
      }
    >
      <div className={compact ? "" : "max-w-md text-center"}>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{error.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.retryGuidance}</p>
        <div className={`mt-6 flex flex-wrap gap-2 ${compact ? "" : "justify-center"}`}>
          {error.retryable && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Try again
            </button>
          ) : null}
          {error.sessionExpired ? (
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in again
            </Link>
          ) : (
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </Link>
          )}
        </div>
        {error.reference ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Reference: <code className="font-mono">{error.reference}</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}
