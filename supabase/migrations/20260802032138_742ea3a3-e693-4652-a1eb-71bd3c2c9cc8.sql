DROP VIEW IF EXISTS public.organization_webhooks_public;

CREATE OR REPLACE FUNCTION public.list_organization_webhooks(_organization_id uuid)
RETURNS TABLE (
  id uuid, organization_id uuid, name text, target_url text, event_types text[],
  status text, last_delivery_at timestamptz, last_delivery_status text,
  secret_fingerprint text, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id, w.organization_id, w.name, w.target_url, w.event_types, w.status,
         w.last_delivery_at, w.last_delivery_status,
         'whsec_…' || right(public.digest_secret(w.secret), 6),
         w.created_at
  FROM public.organization_webhooks w
  WHERE w.organization_id = _organization_id
    AND (public.is_org_member(_organization_id, auth.uid())
         OR public.has_role(auth.uid(), 'admin'))
  ORDER BY w.created_at DESC
$$;

REVOKE EXECUTE ON FUNCTION public.list_organization_webhooks(uuid) FROM anon;