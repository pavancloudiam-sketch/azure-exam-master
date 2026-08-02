import { createFileRoute } from "@tanstack/react-router";

export const APP_VERSION = "0.1.0";

type Check = { status: "ok" | "error"; latency_ms?: number };

/**
 * Health check for uptime monitors.
 *
 * Performs a real database round-trip and an auth-service probe, so a green
 * result means "the app can actually serve requests", not just "the worker
 * booted". Returns no row data, no configuration and no key material; the
 * database probe is a HEAD count, so nothing readable leaves the server.
 */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        const checks: Record<string, Check> = { app: { status: "ok" } };

        const url = process.env["SUPABASE_URL"];
        const publishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

        function logFailure(component: string, context: Record<string, unknown>) {
          console.error(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              severity: "error",
              code: "health.check_failed",
              message: `Health probe failed: ${component}`,
              source: "server",
              context,
            }),
          );
        }

        async function probe(
          name: string,
          run: () => Promise<Response>,
          accept: (response: Response) => boolean,
        ) {
          const probeStartedAt = Date.now();
          try {
            const response = await run();
            const ok = accept(response);
            checks[name] = { status: ok ? "ok" : "error", latency_ms: Date.now() - probeStartedAt };
            if (!ok) logFailure(name, { http_status: response.status });
          } catch (cause) {
            checks[name] = { status: "error", latency_ms: Date.now() - probeStartedAt };
            logFailure(name, { error_name: (cause as Error)?.name ?? "Error" });
          }
        }

        if (!url || !serviceKey) {
          checks["database"] = { status: "error" };
          logFailure("database", { reason: "missing_configuration" });
        } else {
          // HEAD count against a tiny table: exercises PostgREST, the pooler
          // and Postgres, and returns no rows.
          await probe(
            "database",
            () =>
              fetch(`${url}/rest/v1/certifications?select=id&limit=1`, {
                method: "HEAD",
                headers: {
                  apikey: serviceKey,
                  Authorization: `Bearer ${serviceKey}`,
                  Prefer: "count=exact",
                },
              }),
            (response) => response.ok,
          );
        }

        if (!url || !publishableKey) {
          checks["auth"] = { status: "error" };
          logFailure("auth", { reason: "missing_configuration" });
        } else {
          await probe(
            "auth",
            () => fetch(`${url}/auth/v1/health`, { headers: { apikey: publishableKey } }),
            (response) => response.ok,
          );
        }

        const healthy = Object.values(checks).every((check) => check.status === "ok");
        return Response.json(
          {
            status: healthy ? "ok" : "degraded",
            version: APP_VERSION,
            timestamp: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
            checks,
          },
          { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
