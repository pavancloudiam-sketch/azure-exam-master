import { supabase } from "@/integrations/supabase/client";
import type {
  ApiKey,
  ApiRequestLog,
  IssuedApiKey,
  IssuedWebhook,
  SsoConfiguration,
  WebhookDelivery,
  WebhookSummary,
} from "../types";
import { splitList, type ApiKeyInput, type SsoConfigInput, type WebhookInput } from "../validation";

/**
 * Every call below runs against row level security or a SECURITY DEFINER
 * routine that re-checks organisation admin rights server-side. Passing another
 * tenant's id from the browser returns nothing or raises.
 */

export async function getSsoConfiguration(orgId: string): Promise<SsoConfiguration | null> {
  const { data, error } = await supabase
    .from("organization_sso_configurations")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveSsoConfiguration(
  orgId: string,
  input: SsoConfigInput,
): Promise<SsoConfiguration> {
  const { data, error } = await supabase.rpc("upsert_organization_sso", {
    _organization_id: orgId,
    _method: input.method,
    _email_domains: splitList(input.email_domains).map((d) => d.toLowerCase()),
    _allowed_redirect_urls: splitList(input.allowed_redirect_urls),
    _is_enforced: input.is_enforced === "yes",
    ...(input.display_name ? { _display_name: input.display_name } : {}),
    ...(input.metadata_url ? { _metadata_url: input.metadata_url } : {}),
    ...(input.issuer_url ? { _issuer_url: input.issuer_url } : {}),
    ...(input.client_id ? { _client_id: input.client_id } : {}),
  });
  if (error) throw error;
  return data as unknown as SsoConfiguration;
}

export async function listApiKeys(orgId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("organization_api_keys")
    // `key_hash` is deliberately excluded: SELECT on that column is revoked
    // from every Data API role, so a wildcard select would fail outright.
    .select(
      "id, organization_id, name, key_prefix, scopes, rate_limit_per_hour, status, last_used_at, expires_at, revoked_at, revoked_by, created_by, created_at, updated_at",
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ApiKey[];
}

export async function createApiKey(orgId: string, input: ApiKeyInput): Promise<IssuedApiKey> {
  const days = Number(input.expires_in_days || 0);
  const { data, error } = await supabase.rpc("create_organization_api_key", {
    _organization_id: orgId,
    _name: input.name,
    _scopes: splitList(input.scopes),
    _rate_limit_per_hour: Number(input.rate_limit_per_hour),
    ...(days > 0
      ? { _expires_at: new Date(Date.now() + days * 86_400_000).toISOString() }
      : {}),
  });
  if (error) throw error;
  return data as unknown as IssuedApiKey;
}

export async function revokeApiKey(apiKeyId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_organization_api_key", { _api_key_id: apiKeyId });
  if (error) throw error;
}

export async function listWebhooks(orgId: string): Promise<WebhookSummary[]> {
  const { data, error } = await supabase.rpc("list_organization_webhooks", {
    _organization_id: orgId,
  });
  if (error) throw error;
  return (data ?? []) as unknown as WebhookSummary[];
}

export async function createWebhook(orgId: string, input: WebhookInput): Promise<IssuedWebhook> {
  const { data, error } = await supabase.rpc("create_organization_webhook", {
    _organization_id: orgId,
    _name: input.name,
    _target_url: input.target_url,
    _event_types: splitList(input.event_types),
  });
  if (error) throw error;
  return data as unknown as IssuedWebhook;
}

export async function setWebhookStatus(webhookId: string, status: "active" | "disabled") {
  const { error } = await supabase.rpc("set_organization_webhook_status", {
    _webhook_id: webhookId,
    _status: status,
  });
  if (error) throw error;
}

export async function listWebhookDeliveries(orgId: string): Promise<WebhookDelivery[]> {
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}

export async function listApiRequestLogs(orgId: string): Promise<ApiRequestLog[]> {
  const { data, error } = await supabase
    .from("api_request_logs")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data;
}