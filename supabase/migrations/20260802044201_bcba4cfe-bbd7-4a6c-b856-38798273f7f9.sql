REVOKE SELECT ON public.organization_api_keys FROM authenticated, anon;
GRANT SELECT (id, organization_id, name, key_prefix, scopes, rate_limit_per_hour,
  status, expires_at, last_used_at, created_by, revoked_by, revoked_at,
  created_at, updated_at) ON public.organization_api_keys TO authenticated;

REVOKE SELECT ON public.organization_webhooks FROM authenticated, anon;
GRANT SELECT (id, organization_id, name, target_url, event_types, status,
  last_delivery_at, last_delivery_status, created_by, created_at, updated_at)
  ON public.organization_webhooks TO authenticated;

REVOKE SELECT ON public.scim_provisioning_tokens FROM authenticated, anon;
GRANT SELECT (id, organization_id, name, token_prefix, status, revoked_at,
  created_by, created_at, updated_at) ON public.scim_provisioning_tokens TO authenticated;