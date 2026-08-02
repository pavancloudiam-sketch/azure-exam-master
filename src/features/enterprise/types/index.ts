import type { Database } from "@/integrations/supabase/types";

export type SsoConfiguration =
  Database["public"]["Tables"]["organization_sso_configurations"]["Row"];
export type ApiKey = Database["public"]["Tables"]["organization_api_keys"]["Row"];
export type ApiRequestLog = Database["public"]["Tables"]["api_request_logs"]["Row"];
export type WebhookDelivery = Database["public"]["Tables"]["webhook_deliveries"]["Row"];

/** Webhook rows as returned by `list_organization_webhooks` — never the secret. */
export type WebhookSummary = {
  id: string;
  organization_id: string;
  name: string;
  target_url: string;
  event_types: string[];
  status: string;
  last_delivery_at: string | null;
  last_delivery_status: string | null;
  secret_fingerprint: string;
  created_at: string;
};

/** Returned exactly once at creation time; the plaintext is never stored. */
export type IssuedApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  api_key: string;
};

export type IssuedWebhook = {
  id: string;
  name: string;
  target_url: string;
  event_types: string[];
  signing_secret: string;
};

export const SSO_METHODS = {
  password: "Email and password only",
  google: "Google sign-in",
  entra_saml: "Microsoft Entra ID (SAML 2.0)",
  oidc: "Generic OpenID Connect",
} as const;

export type SsoMethod = keyof typeof SSO_METHODS;

/**
 * Read scopes only. Nothing in this milestone lets an API key change data,
 * so a leaked key cannot mutate a tenant.
 */
export const API_SCOPES = {
  "org:read": "Read the organisation profile",
  "members:read": "Read organisation members",
  "attempts:read": "Read organisation attempt counts",
  "results:read": "Read organisation result summaries",
  "webhooks:read": "Read webhook endpoints and deliveries",
} as const;

export type ApiScope = keyof typeof API_SCOPES;

export const WEBHOOK_EVENT_TYPES = {
  "member.invited": "A member was invited",
  "member.joined": "A member accepted an invitation",
  "member.removed": "A member was removed",
  "attempt.submitted": "A member submitted an attempt",
  "entitlement.changed": "Organisation access changed",
} as const;

export type WebhookEventType = keyof typeof WEBHOOK_EVENT_TYPES;