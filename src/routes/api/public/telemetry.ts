import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EVENT_CODES } from "@/features/observability/types";

/**
 * Client telemetry ingest. Browser events are re-emitted as structured server
 * logs so that client and server failures share one searchable stream.
 *
 * Security: unauthenticated by design (login failures happen before a session
 * exists), so the payload is treated as untrusted. Only a fixed event
 * vocabulary is accepted, string lengths are capped, context values must be
 * scalars, and nothing is written to the database.
 */
const scalar = z.union([z.string().max(200), z.number(), z.boolean(), z.null()]);

const eventSchema = z.object({
  timestamp: z.string().max(40).optional(),
  severity: z.enum(["info", "warn", "error"]).default("error"),
  code: z.enum(EVENT_CODES),
  message: z.string().max(200),
  correlation_id: z.string().max(64),
  request_id: z.string().max(64),
  route: z.string().max(200).optional(),
  context: z.record(z.string().max(60), scalar).optional(),
});

const MAX_BODY_BYTES = 4096;

export const Route = createFileRoute("/api/public/telemetry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        if (body.length > MAX_BODY_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }

        let parsed;
        try {
          parsed = eventSchema.safeParse(JSON.parse(body));
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!parsed.success) return new Response("Invalid event", { status: 400 });

        const event = {
          ...parsed.data,
          timestamp: parsed.data.timestamp ?? new Date().toISOString(),
          source: "client" as const,
        };

        // One JSON line per event — greppable by code, correlation_id or request_id.
        const line = JSON.stringify(event);
        if (event.severity === "error") console.error(line);
        else if (event.severity === "warn") console.warn(line);
        else console.info(line);

        return new Response(null, { status: 204 });
      },
    },
  },
});
