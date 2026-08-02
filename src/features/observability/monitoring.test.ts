import { afterEach, describe, expect, it, vi } from "vitest";

import { captureToSentry, isSentryEnabled } from "./sentry.server";

/**
 * Monitoring must be inert without a DSN and must never leak credential-shaped
 * text into an outbound report.
 */
const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function freshModule() {
  vi.resetModules();
  return import("./sentry.server");
}

describe("sentry transport", () => {
  it("is disabled when no DSN is configured", async () => {
    delete process.env["SENTRY_DSN"];
    const mod = await freshModule();
    expect(mod.isSentryEnabled()).toBe(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      mod.captureToSentry({ code: "server.unexpected_error", message: "boom", severity: "error" }),
    ).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays disabled on a malformed DSN instead of throwing", async () => {
    process.env["SENTRY_DSN"] = "not-a-dsn";
    const mod = await freshModule();
    expect(mod.isSentryEnabled()).toBe(false);
  });

  it("posts a redacted envelope with correlation tags", async () => {
    process.env["SENTRY_DSN"] = "https://publickey@o1.ingest.sentry.io/42";
    process.env["SENTRY_ENVIRONMENT"] = "production";
    const mod = await freshModule();

    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const ok = await mod.captureToSentry({
      code: "queue.jobs_dead_lettered",
      message: "failed for user someone@example.com",
      severity: "error",
      correlationId: "corr-1",
      requestId: "req-1",
      source: "cron",
      context: { count: 3, authorization: "Bearer abc123" },
    });

    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://o1.ingest.sentry.io/api/42/envelope/");
    const body = String(init.body);
    expect(body).toContain("queue.jobs_dead_lettered");
    expect(body).toContain("corr-1");
    expect(body).toContain('"environment":"production"');
    // Redaction still applies on the way out.
    expect(body).not.toContain("someone@example.com");
    expect(body).not.toContain("Bearer abc123");
    expect(body).not.toContain("authorization");
  });

  it("never throws when the monitoring endpoint is unreachable", async () => {
    process.env["SENTRY_DSN"] = "https://publickey@o1.ingest.sentry.io/42";
    const mod = await freshModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    await expect(
      mod.captureToSentry({ code: "cron.run_failed", message: "boom", severity: "error" }),
    ).resolves.toBe(false);
  });
});

describe("module exports", () => {
  it("exposes the enablement check", () => {
    expect(typeof isSentryEnabled).toBe("function");
    expect(typeof captureToSentry).toBe("function");
  });
});
