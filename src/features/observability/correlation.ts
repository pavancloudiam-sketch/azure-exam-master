/**
 * Correlation ids tie the events of one browser session together; request ids
 * identify a single operation and are the reference shown to users on error
 * screens, so support can find the matching server log line.
 */
const STORAGE_KEY = "askmeexam.correlation_id";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

let memoryCorrelationId: string | null = null;

/** Stable for the browser session. Contains no user data. */
export function getCorrelationId(): string {
  if (memoryCorrelationId) return memoryCorrelationId;
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        memoryCorrelationId = stored;
        return stored;
      }
      const created = randomId();
      window.sessionStorage.setItem(STORAGE_KEY, created);
      memoryCorrelationId = created;
      return created;
    } catch {
      // Private mode / storage disabled — fall through to a memory-only id.
    }
  }
  memoryCorrelationId = randomId();
  return memoryCorrelationId;
}

/** Fresh id per operation. */
export function newRequestId(): string {
  return randomId();
}

/** Short form shown in the UI ("Reference: 3f2a9c1b"). */
export function shortReference(requestId: string): string {
  return requestId.replaceAll("-", "").slice(0, 8);
}
