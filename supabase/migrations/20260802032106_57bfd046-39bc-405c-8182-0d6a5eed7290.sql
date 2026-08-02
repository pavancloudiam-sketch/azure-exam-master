-- ============ helpers =====================================================
CREATE OR REPLACE FUNCTION public.digest_secret(_secret text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(extensions.digest(_secret, 'sha256'), 'hex')
$$;

-- ============ organisation SSO configuration ==============================
CREATE TABLE public.organization_sso_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'password'
    CHECK (method IN ('password', 'google', 'entra_saml', 'oidc')),
  display_name text,
  email_domains text[] NOT NULL DEFAULT '{}',
  allowed_redirect_urls text[] NOT NULL DEFAULT '{}',
  metadata_url text,
  issuer_url text,
  client_id text,
  is_enforced boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_verification', 'active', 'disabled')),
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

CREATE OR REPLACE FUNCTION public.validate_sso_configuration()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE u text;
BEGIN
  FOREACH u IN ARRAY NEW.allowed_redirect_urls LOOP
    IF u !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~!$&''()*+,;=:@%/-]*)?$' THEN
      RAISE EXCEPTION 'Redirect URL must be an absolute https URL: %', u;
    END IF;
  END LOOP;
  IF NEW.metadata_url IS NOT NULL AND NEW.metadata_url !~ '^https://' THEN
    RAISE EXCEPTION 'Metadata URL must use https';
  END IF;
  IF NEW.issuer_url IS NOT NULL AND NEW.issuer_url !~ '^https://' THEN
    RAISE EXCEPTION 'Issuer URL must use https';
  END IF;
  IF NEW.method = 'entra_saml' AND coalesce(btrim(NEW.metadata_url), '') = ''
     AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'A SAML metadata URL is required before activation';
  END IF;
  IF NEW.method = 'oidc' AND coalesce(btrim(NEW.issuer_url), '') = ''
     AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'An issuer URL is required before activation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_sso_configuration
BEFORE INSERT OR UPDATE ON public.organization_sso_configurations
FOR EACH ROW EXECUTE FUNCTION public.validate_sso_configuration();

GRANT SELECT, INSERT, UPDATE ON public.organization_sso_configurations TO authenticated;
GRANT ALL ON public.organization_sso_configurations TO service_role;
ALTER TABLE public.organization_sso_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sso readable inside the tenant"
  ON public.organization_sso_configurations FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sso managed by org admins"
  ON public.organization_sso_configurations FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "sso updated by org admins"
  ON public.organization_sso_configurations FOR UPDATE TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ API keys ====================================================
CREATE TABLE public.organization_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT '{}',
  rate_limit_per_hour integer NOT NULL DEFAULT 1000 CHECK (rate_limit_per_hour BETWEEN 1 AND 100000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  revoked_by uuid REFERENCES auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_org ON public.organization_api_keys (organization_id, status);

GRANT SELECT ON public.organization_api_keys TO authenticated;
GRANT ALL ON public.organization_api_keys TO service_role;
ALTER TABLE public.organization_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api keys readable inside the tenant"
  ON public.organization_api_keys FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.api_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  api_key_id uuid REFERENCES public.organization_api_keys(id) ON DELETE SET NULL,
  method text NOT NULL,
  path text NOT NULL,
  status_code integer NOT NULL,
  outcome text NOT NULL,
  duration_ms integer,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_request_logs_key_time ON public.api_request_logs (api_key_id, created_at DESC);
CREATE INDEX idx_api_request_logs_org_time ON public.api_request_logs (organization_id, created_at DESC);

GRANT SELECT ON public.api_request_logs TO authenticated;
GRANT ALL ON public.api_request_logs TO service_role;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api logs readable inside the tenant"
  ON public.api_request_logs FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ webhooks ====================================================
CREATE TABLE public.organization_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_url text NOT NULL CHECK (target_url ~ '^https://'),
  secret text NOT NULL,
  event_types text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  last_delivery_at timestamptz,
  last_delivery_status text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhooks_org ON public.organization_webhooks (organization_id, status);

-- The signing secret is never exposed to the browser; reads go through a view.
GRANT SELECT ON public.organization_webhooks TO authenticated;
GRANT ALL ON public.organization_webhooks TO service_role;
ALTER TABLE public.organization_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks hidden from direct reads"
  ON public.organization_webhooks FOR SELECT TO authenticated USING (false);

CREATE VIEW public.organization_webhooks_public
WITH (security_invoker = off) AS
  SELECT w.id, w.organization_id, w.name, w.target_url, w.event_types, w.status,
         w.last_delivery_at, w.last_delivery_status, w.created_at, w.updated_at,
         'whsec_' || left(public.digest_secret(w.secret), 8) AS secret_fingerprint
  FROM public.organization_webhooks w
  WHERE public.is_org_member(w.organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin');

GRANT SELECT ON public.organization_webhooks_public TO authenticated;
GRANT ALL ON public.organization_webhooks_public TO service_role;

CREATE TABLE public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, idempotency_key)
);
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook events readable inside the tenant"
  ON public.webhook_events FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES public.organization_webhooks(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.webhook_events(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  response_status integer,
  last_error text,
  signature text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (webhook_id, event_id)
);
CREATE INDEX idx_webhook_deliveries_org ON public.webhook_deliveries (organization_id, created_at DESC);
GRANT SELECT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook deliveries readable inside the tenant"
  ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ SCIM tokens (planned; no endpoint enabled yet) ==============
CREATE TABLE public.scim_provisioning_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  token_prefix text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'revoked')),
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.scim_provisioning_tokens TO authenticated;
GRANT ALL ON public.scim_provisioning_tokens TO service_role;
ALTER TABLE public.scim_provisioning_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scim tokens readable inside the tenant"
  ON public.scim_provisioning_tokens FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- ============ management routines =========================================
CREATE OR REPLACE FUNCTION public.upsert_organization_sso(
  _organization_id uuid, _method text, _display_name text DEFAULT NULL,
  _email_domains text[] DEFAULT '{}', _allowed_redirect_urls text[] DEFAULT '{}',
  _metadata_url text DEFAULT NULL, _issuer_url text DEFAULT NULL,
  _client_id text DEFAULT NULL, _is_enforced boolean DEFAULT false,
  _status text DEFAULT 'draft')
RETURNS public.organization_sso_configurations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.organization_sso_configurations;
BEGIN
  IF NOT (public.is_org_admin(_organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Organisation admin role required';
  END IF;

  INSERT INTO public.organization_sso_configurations AS s
    (organization_id, method, display_name, email_domains, allowed_redirect_urls,
     metadata_url, issuer_url, client_id, is_enforced, status)
  VALUES (_organization_id, _method, NULLIF(btrim(coalesce(_display_name, '')), ''),
          coalesce(_email_domains, '{}'), coalesce(_allowed_redirect_urls, '{}'),
          NULLIF(btrim(coalesce(_metadata_url, '')), ''),
          NULLIF(btrim(coalesce(_issuer_url, '')), ''),
          NULLIF(btrim(coalesce(_client_id, '')), ''), _is_enforced, _status)
  ON CONFLICT (organization_id) DO UPDATE
    SET method = EXCLUDED.method, display_name = EXCLUDED.display_name,
        email_domains = EXCLUDED.email_domains,
        allowed_redirect_urls = EXCLUDED.allowed_redirect_urls,
        metadata_url = EXCLUDED.metadata_url, issuer_url = EXCLUDED.issuer_url,
        client_id = EXCLUDED.client_id, is_enforced = EXCLUDED.is_enforced,
        status = EXCLUDED.status,
        verified_at = CASE WHEN EXCLUDED.status = 'active' THEN coalesce(s.verified_at, now()) END
  RETURNING * INTO c;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label,
                                 organization_id, details)
  VALUES (auth.uid(), 'organization.sso_updated', 'organization_sso', c.id, c.method,
          _organization_id, jsonb_build_object('status', c.status, 'enforced', c.is_enforced));
  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_organization_api_key(
  _organization_id uuid, _name text, _scopes text[],
  _rate_limit_per_hour integer DEFAULT 1000, _expires_at timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_secret text; v_key text; v_prefix text; k public.organization_api_keys;
  v_allowed text[] := ARRAY['org:read','members:read','attempts:read','results:read','webhooks:read'];
  s text;
BEGIN
  IF NOT (public.is_org_admin(_organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Organisation admin role required';
  END IF;
  IF coalesce(btrim(_name), '') = '' THEN RAISE EXCEPTION 'A key name is required'; END IF;
  IF _scopes IS NULL OR cardinality(_scopes) = 0 THEN
    RAISE EXCEPTION 'At least one scope is required';
  END IF;
  FOREACH s IN ARRAY _scopes LOOP
    IF NOT (s = ANY(v_allowed)) THEN RAISE EXCEPTION 'Unknown scope: %', s; END IF;
  END LOOP;

  v_secret := encode(extensions.gen_random_bytes(24), 'hex');
  v_prefix := 'ame_' || left(replace(gen_random_uuid()::text, '-', ''), 8);
  v_key := v_prefix || '.' || v_secret;

  INSERT INTO public.organization_api_keys
    (organization_id, name, key_prefix, key_hash, scopes, rate_limit_per_hour,
     expires_at, created_by)
  VALUES (_organization_id, btrim(_name), v_prefix, public.digest_secret(v_key),
          _scopes, coalesce(_rate_limit_per_hour, 1000), _expires_at, auth.uid())
  RETURNING * INTO k;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label,
                                 organization_id, details)
  VALUES (auth.uid(), 'organization.api_key_created', 'api_key', k.id, k.name,
          _organization_id, jsonb_build_object('scopes', _scopes, 'prefix', v_prefix));

  -- The plaintext key is returned exactly once and never stored.
  RETURN jsonb_build_object('id', k.id, 'name', k.name, 'prefix', v_prefix,
                            'scopes', k.scopes, 'api_key', v_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_organization_api_key(_api_key_id uuid)
RETURNS public.organization_api_keys
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.organization_api_keys;
BEGIN
  SELECT * INTO k FROM public.organization_api_keys WHERE id = _api_key_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'API key not found'; END IF;
  IF NOT (public.is_org_admin(k.organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Organisation admin role required';
  END IF;

  UPDATE public.organization_api_keys
  SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid(), updated_at = now()
  WHERE id = _api_key_id RETURNING * INTO k;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label,
                                 organization_id, details)
  VALUES (auth.uid(), 'organization.api_key_revoked', 'api_key', k.id, k.name,
          k.organization_id, '{}'::jsonb);
  RETURN k;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_organization_webhook(
  _organization_id uuid, _name text, _target_url text, _event_types text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.organization_webhooks; v_secret text;
  v_allowed text[] := ARRAY['member.invited','member.joined','member.removed',
                            'attempt.submitted','entitlement.changed'];
  e text;
BEGIN
  IF NOT (public.is_org_admin(_organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Organisation admin role required';
  END IF;
  IF _target_url !~ '^https://' THEN RAISE EXCEPTION 'Webhook URL must use https'; END IF;
  IF _event_types IS NULL OR cardinality(_event_types) = 0 THEN
    RAISE EXCEPTION 'Select at least one event type';
  END IF;
  FOREACH e IN ARRAY _event_types LOOP
    IF NOT (e = ANY(v_allowed)) THEN RAISE EXCEPTION 'Unknown event type: %', e; END IF;
  END LOOP;

  v_secret := 'whsec_' || encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO public.organization_webhooks
    (organization_id, name, target_url, secret, event_types, created_by)
  VALUES (_organization_id, btrim(_name), _target_url, v_secret, _event_types, auth.uid())
  RETURNING * INTO w;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label,
                                 organization_id, details)
  VALUES (auth.uid(), 'organization.webhook_created', 'webhook', w.id, w.name,
          _organization_id, jsonb_build_object('events', _event_types));

  -- Signing secret returned once so the receiving system can verify signatures.
  RETURN jsonb_build_object('id', w.id, 'name', w.name, 'target_url', w.target_url,
                            'event_types', w.event_types, 'signing_secret', v_secret);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_organization_webhook_status(_webhook_id uuid, _status text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_org uuid;
BEGIN
  SELECT organization_id INTO v_org FROM public.organization_webhooks WHERE id = _webhook_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Webhook not found'; END IF;
  IF NOT (public.is_org_admin(v_org, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Organisation admin role required';
  END IF;
  IF _status NOT IN ('active', 'disabled') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  UPDATE public.organization_webhooks SET status = _status, updated_at = now()
  WHERE id = _webhook_id;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id,
                                 organization_id, details)
  VALUES (auth.uid(), 'organization.webhook_' || _status, 'webhook', _webhook_id,
          v_org, '{}'::jsonb);
  RETURN true;
END;
$$;

-- Queue an event once per organisation; repeat keys are ignored (idempotency).
CREATE OR REPLACE FUNCTION public.enqueue_webhook_event(
  _organization_id uuid, _event_type text, _idempotency_key text, _payload jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_event_id uuid; w record;
BEGIN
  INSERT INTO public.webhook_events (organization_id, event_type, idempotency_key, payload)
  VALUES (_organization_id, _event_type, _idempotency_key, coalesce(_payload, '{}'::jsonb))
  ON CONFLICT (organization_id, idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN RETURN NULL; END IF;

  FOR w IN SELECT id FROM public.organization_webhooks
           WHERE organization_id = _organization_id AND status = 'active'
             AND _event_type = ANY(event_types) LOOP
    INSERT INTO public.webhook_deliveries (webhook_id, event_id, organization_id)
    VALUES (w.id, v_event_id, _organization_id)
    ON CONFLICT (webhook_id, event_id) DO NOTHING;
  END LOOP;

  RETURN v_event_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_organization_sso(uuid, text, text, text[], text[], text, text, text, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_organization_api_key(uuid, text, text[], integer, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_organization_api_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_organization_webhook(uuid, text, text, text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_organization_webhook_status(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_webhook_event(uuid, text, text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.digest_secret(text) FROM anon;