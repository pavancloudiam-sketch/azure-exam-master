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
  return Boolean(publishable) && Boolean(apikey) && safeEqual(apikey, publishable);
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

        try {
          const { runQueueWorker } = await import(
            "@/features/queue/services/queue-worker.server"
          );
          const summary = await runQueueWorker(10);
          return new Response(JSON.stringify({ status: "ok", ...summary }), {
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        } catch (cause) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              severity: "error",
              code: "server.unexpected_error",
              message: "Queue worker run failed",
              source: "server",
              context: { error_name: (cause as Error)?.name ?? "Error" },
            }),
          );
          return new Response(JSON.stringify({ status: "error" }), {
            status: 500,
            headers: { "content-type": "application/json", "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
