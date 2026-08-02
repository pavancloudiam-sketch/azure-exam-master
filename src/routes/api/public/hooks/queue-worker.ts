import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron entry point for the shared queue worker.
 *
 * Public prefix (auth is bypassed at the edge), so the handler authenticates the
 * caller itself: either the shared secret in `x-queue-worker-secret` (when
 * `QUEUE_WORKER_SECRET` is configured) or the project publishable key in the
 * `apikey` header, which is what pg_cron sends. Comparison is length-checked and
 * constant time. The endpoint returns counters only — never recipients, payloads
 * or signing material.
 */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorize(request: Request) {
  const sharedSecret = process.env["QUEUE_WORKER_SECRET"];
  const provided = request.headers.get("x-queue-worker-secret");
  if (sharedSecret && provided && safeEqual(provided, sharedSecret)) return true;

  const publishable =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
  const apikey = request.headers.get("apikey");
  return Boolean(publishable) && Boolean(apikey) && safeEqual(apikey ?? "", publishable);
}

export const Route = createFileRoute("/api/public/hooks/queue-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!authorize(request)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }

        // One correlation id per cron tick, echoed back so an external
        // scheduler's log line can be joined to the server's.
        const runId =
          request.headers.get("x-request-id") ??
          globalThis.crypto?.randomUUID?.() ??
          String(Date.now());

        try {
          const { runQueueWorker } = await import(
            "@/features/queue/services/queue-worker.server"
          );
          const summary = await runQueueWorker(10, runId);
          return new Response(JSON.stringify({ status: "ok", run_id: runId, ...summary }), {
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
              "x-request-id": runId,
            },
          });
        } catch (cause) {
          // Cron failure alert: the whole tick died, so no one is watching.
          const { raiseOpsAlert } = await import("@/features/observability/monitoring.server");
          await raiseOpsAlert({
            code: "cron.run_failed",
            message: "Queue worker cron run failed",
            correlationId: runId,
            cause,
          });
          return new Response(JSON.stringify({ status: "error", run_id: runId }), {
            status: 500,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
              "x-request-id": runId,
            },
          });
        }
      },
    },
  },
});
