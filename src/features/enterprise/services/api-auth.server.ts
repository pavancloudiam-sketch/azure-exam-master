import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ApiScope } from "../types";

export type ApiKeyContext = {
  apiKeyId: string;
  organizationId: string;
  scopes: string[];
  requestId: string;
  admin: SupabaseClient<Database>;
};

export type ApiFailure = { response: Response };

const RATE_WINDOW_MS = 60 * 60 * 1000;

/** SHA-256 hex, matching `public.digest_secret` in the database. */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function json(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId },
  });
}

/**
 * Authenticates a public API request from an `Authorization: Bearer ame_…` key.
 *
 * The plaintext key is never stored, never logged and never echoed back: only
 * its SHA-256 digest is compared. Every outcome — including failures — is
 * written to `api_request_logs` so a tenant can audit key use, and every
 * request counts against the key's hourly rate limit.
 */
export async function authenticateApiRequest(
  request: Request,
  path: string,
  requiredScope: ApiScope,
): Promise<ApiKeyContext | ApiFailure> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SupabaseClient<Database>;

  async function log(
    status: number,
    outcome: string,
    ids: { apiKeyId?: string; organizationId?: string } = {},
  ) {
    await admin.from("api_request_logs").insert({
      api_key_id: ids.apiKeyId ?? null,
      organization_id: ids.organizationId ?? null,
      method: request.method,
      path,
      status_code: status,
      outcome,
      request_id: requestId,
      duration_ms: Date.now() - startedAt,
    });
  }

  const header = request.headers.get("authorization") ?? "";
  const presented = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!presented.startsWith("ame_")) {
    await log(401, "missing_key");
    return {
      response: json(
        { error: "unauthorized", message: "Provide an AskMeExam API key as a bearer token." },
        401,
        requestId,
      ),
    };
  }

  const { data: key } = await admin
    .from("organization_api_keys")
    .select("id, organization_id, scopes, status, expires_at, rate_limit_per_hour")
    .eq("key_hash", await sha256Hex(presented))
    .maybeSingle();

  if (!key || key.status !== "active") {
    await log(401, "invalid_key");
    return {
      response: json(
        { error: "unauthorized", message: "This API key is not valid or has been revoked." },
        401,
        requestId,
      ),
    };
  }

  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) {
    await log(401, "expired_key", { apiKeyId: key.id, organizationId: key.organization_id });
    return {
      response: json({ error: "unauthorized", message: "This API key has expired." }, 401, requestId),
    };
  }

  const { count } = await admin
    .from("api_request_logs")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", key.id)
    .gte("created_at", new Date(Date.now() - RATE_WINDOW_MS).toISOString());

  if ((count ?? 0) >= key.rate_limit_per_hour) {
    await log(429, "rate_limited", { apiKeyId: key.id, organizationId: key.organization_id });
    return {
      response: json(
        {
          error: "rate_limited",
          message: `This key is limited to ${key.rate_limit_per_hour} requests per hour. Retry later.`,
        },
        429,
        requestId,
      ),
    };
  }

  if (!key.scopes.includes(requiredScope)) {
    await log(403, "missing_scope", { apiKeyId: key.id, organizationId: key.organization_id });
    return {
      response: json(
        { error: "forbidden", message: `This key does not hold the ${requiredScope} scope.` },
        403,
        requestId,
      ),
    };
  }

  await admin
    .from("organization_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);
  await log(200, "ok", { apiKeyId: key.id, organizationId: key.organization_id });

  return {
    apiKeyId: key.id,
    organizationId: key.organization_id,
    scopes: key.scopes,
    requestId,
    admin,
  };
}

export function isFailure(result: ApiKeyContext | ApiFailure): result is ApiFailure {
  return "response" in result;
}

export function apiJson(body: unknown, requestId: string, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": requestId },
  });
}