-- ============================================================
-- Data rights: exports, deletion workflows, retention controls
-- ============================================================

CREATE TABLE public.data_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('user', 'organization')),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'expired', 'failed')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  byte_size integer NOT NULL DEFAULT 0,
  download_count integer NOT NULL DEFAULT 0,
  requested_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '48 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (scope = 'user' OR organization_id IS NOT NULL)
);

GRANT SELECT ON public.data_export_requests TO authenticated;
GRANT ALL ON public.data_export_requests TO service_role;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their own exports"
  ON public.data_export_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Org admins read their organisation exports"
  ON public.data_export_requests FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Platform admins read all exports"
  ON public.data_export_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_data_export_requests_user ON public.data_export_requests (user_id, requested_at DESC);
CREATE INDEX idx_data_export_requests_org ON public.data_export_requests (organization_id, requested_at DESC)
  WHERE organization_id IS NOT NULL;
CREATE INDEX idx_data_export_requests_expiry ON public.data_export_requests (expires_at) WHERE status = 'ready';

CREATE TRIGGER set_data_export_requests_updated_at
  BEFORE UPDATE ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Account deletion
-- ------------------------------------------------------------

CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'cancelled', 'approved', 'rejected', 'completed')),
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL DEFAULT now() + interval '30 days',
  cancelled_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_note text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_account_deletion_open
  ON public.account_deletion_requests (user_id)
  WHERE status IN ('pending', 'approved');

GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own deletion requests"
  ON public.account_deletion_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Platform admins read deletion requests"
  ON public.account_deletion_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_account_deletion_requests_updated_at
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Organisation deletion
-- ------------------------------------------------------------

CREATE TABLE public.organization_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'cancelled', 'approved', 'rejected', 'completed')),
  reason text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for timestamptz NOT NULL DEFAULT now() + interval '30 days',
  cancelled_at timestamptz,
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_note text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_org_deletion_open
  ON public.organization_deletion_requests (organization_id)
  WHERE status IN ('pending', 'approved');

GRANT SELECT ON public.organization_deletion_requests TO authenticated;
GRANT ALL ON public.organization_deletion_requests TO service_role;
ALTER TABLE public.organization_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins read their organisation deletion requests"
  ON public.organization_deletion_requests FOR SELECT TO authenticated
  USING (public.is_org_admin(organization_id, auth.uid()));

CREATE POLICY "Platform admins read organisation deletion requests"
  ON public.organization_deletion_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_organization_deletion_requests_updated_at
  BEFORE UPDATE ON public.organization_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- Retention controls
-- ------------------------------------------------------------

CREATE TABLE public.retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  attempt_retention_days integer CHECK (attempt_retention_days IS NULL OR attempt_retention_days >= 30),
  ai_log_retention_days integer NOT NULL DEFAULT 180 CHECK (ai_log_retention_days BETWEEN 7 AND 3650),
  api_log_retention_days integer NOT NULL DEFAULT 90 CHECK (api_log_retention_days BETWEEN 7 AND 3650),
  export_ttl_hours integer NOT NULL DEFAULT 48 CHECK (export_ttl_hours BETWEEN 1 AND 720),
  deletion_grace_days integer NOT NULL DEFAULT 30 CHECK (deletion_grace_days BETWEEN 0 AND 180),
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_retention_policy_platform
  ON public.retention_policies ((organization_id IS NULL)) WHERE organization_id IS NULL;
CREATE UNIQUE INDEX idx_retention_policy_org
  ON public.retention_policies (organization_id) WHERE organization_id IS NOT NULL;

GRANT SELECT ON public.retention_policies TO authenticated;
GRANT ALL ON public.retention_policies TO service_role;
ALTER TABLE public.retention_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read their retention policy"
  ON public.retention_policies FOR SELECT TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Everyone reads the platform retention policy"
  ON public.retention_policies FOR SELECT TO authenticated
  USING (organization_id IS NULL);

CREATE TRIGGER set_retention_policies_updated_at
  BEFORE UPDATE ON public.retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.retention_policies (organization_id, ai_log_retention_days, api_log_retention_days, export_ttl_hours, deletion_grace_days, notes)
VALUES (NULL, 180, 90, 48, 30, 'Platform default. Attempt history is kept indefinitely unless a deletion request completes.');

-- ============================================================
-- Routines
-- ============================================================

-- Personal data export. Never includes answer keys or explanations.
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS public.data_export_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ttl integer;
  _payload jsonb;
  _row public.data_export_requests;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT export_ttl_hours INTO _ttl FROM public.retention_policies WHERE organization_id IS NULL;
  _ttl := COALESCE(_ttl, 48);

  SELECT jsonb_build_object(
    'generated_at', now(),
    'generated_by', 'AskMeExam',
    'subject', jsonb_build_object('user_id', _uid),
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _uid),
    'roles', (SELECT COALESCE(jsonb_agg(r.role), '[]'::jsonb) FROM public.user_roles r WHERE r.user_id = _uid),
    'attempts', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'attempt_id', a.id, 'exam', e.title, 'mode', a.mode, 'status', a.status,
        'started_at', a.started_at, 'submitted_at', a.submitted_at,
        'raw_score', a.raw_score, 'max_score', a.max_score, 'percentage', a.percentage,
        'scaled_score', a.scaled_score, 'passed', a.passed,
        'duration_seconds', a.duration_seconds
      ) ORDER BY a.started_at DESC), '[]'::jsonb)
      FROM public.attempts a JOIN public.exams e ON e.id = a.exam_id
      WHERE a.user_id = _uid
    ),
    'answers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'attempt_id', aa.attempt_id, 'question_id', aa.question_id,
        'selected_option_ids', aa.selected_option_ids,
        'marked_for_review', aa.marked_for_review, 'answered_at', aa.answered_at
      )), '[]'::jsonb)
      FROM public.attempt_answers aa
      JOIN public.attempts a ON a.id = aa.attempt_id
      WHERE a.user_id = _uid
    ),
    'orders', (
      SELECT COALESCE(jsonb_agg(to_jsonb(o)), '[]'::jsonb) FROM public.orders o WHERE o.user_id = _uid
    ),
    'invoices', (
      SELECT COALESCE(jsonb_agg(to_jsonb(i)), '[]'::jsonb) FROM public.invoices i WHERE i.user_id = _uid
    ),
    'refunds', (
      SELECT COALESCE(jsonb_agg(to_jsonb(rf)), '[]'::jsonb) FROM public.refunds rf WHERE rf.user_id = _uid
    ),
    'subscriptions', (
      SELECT COALESCE(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.subscriptions s WHERE s.user_id = _uid
    ),
    'entitlements', (
      SELECT COALESCE(jsonb_agg(to_jsonb(en)), '[]'::jsonb) FROM public.entitlements en WHERE en.user_id = _uid
    ),
    'billing_profile', (SELECT to_jsonb(b) FROM public.billing_profiles b WHERE b.user_id = _uid),
    'consents', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'doc_type', la.doc_type, 'version', la.version,
        'context', la.context, 'accepted_at', la.accepted_at
      ) ORDER BY la.accepted_at), '[]'::jsonb)
      FROM public.legal_acceptances la WHERE la.user_id = _uid
    ),
    'organization_memberships', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'organization', o.name, 'status', m.status,
        'invited_at', m.invited_at, 'joined_at', m.joined_at
      )), '[]'::jsonb)
      FROM public.organization_members m JOIN public.organizations o ON o.id = m.organization_id
      WHERE m.user_id = _uid
    ),
    'ai_usage', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'feature', l.feature, 'status', l.status, 'created_at', l.created_at
      ) ORDER BY l.created_at DESC), '[]'::jsonb)
      FROM public.ai_usage_logs l WHERE l.user_id = _uid
    ),
    'ai_interviews', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'title', s.title, 'topic', s.topic, 'difficulty', s.difficulty,
        'status', s.status, 'created_at', s.created_at
      )), '[]'::jsonb)
      FROM public.ai_interview_sessions s WHERE s.user_id = _uid
    ),
    'notice', 'Question text, option text, answer keys and explanations are AskMeExam content and are not part of a personal data export.'
  ) INTO _payload;

  INSERT INTO public.data_export_requests (scope, user_id, payload, byte_size, expires_at)
  VALUES ('user', _uid, _payload, length(_payload::text), now() + make_interval(hours => _ttl))
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (_uid, 'privacy.user_export_created', 'data_export_request', _row.id, 'Personal data export',
          jsonb_build_object('byte_size', _row.byte_size, 'expires_at', _row.expires_at));

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.export_my_data() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;

-- Organisation export. Secrets and key hashes are never included.
CREATE OR REPLACE FUNCTION public.export_organization_data(_organization_id uuid)
RETURNS public.data_export_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _ttl integer;
  _payload jsonb;
  _row public.data_export_requests;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT (public.is_org_admin(_organization_id, _uid) OR public.has_role(_uid, 'admin')) THEN
    RAISE EXCEPTION 'Only an organisation administrator may export this organisation';
  END IF;

  SELECT COALESCE(
    (SELECT export_ttl_hours FROM public.retention_policies WHERE organization_id = _organization_id),
    (SELECT export_ttl_hours FROM public.retention_policies WHERE organization_id IS NULL),
    48) INTO _ttl;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'generated_by', 'AskMeExam',
    'organization', (SELECT to_jsonb(o) FROM public.organizations o WHERE o.id = _organization_id),
    'settings', (SELECT to_jsonb(s) FROM public.organization_settings s WHERE s.organization_id = _organization_id),
    'members', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'email', p.email, 'full_name', p.full_name,
        'status', m.status, 'invited_at', m.invited_at, 'joined_at', m.joined_at,
        'removed_at', m.removed_at,
        'roles', (SELECT COALESCE(jsonb_agg(r.role), '[]'::jsonb) FROM public.organization_roles r
                  WHERE r.organization_id = _organization_id AND r.user_id = m.user_id)
      )), '[]'::jsonb)
      FROM public.organization_members m
      LEFT JOIN public.profiles p ON p.id = m.user_id
      WHERE m.organization_id = _organization_id
    ),
    'entitlements', (
      SELECT COALESCE(jsonb_agg(to_jsonb(e)), '[]'::jsonb)
      FROM public.organization_entitlements e WHERE e.organization_id = _organization_id
    ),
    'sso_configuration', (
      SELECT jsonb_build_object('method', c.method, 'display_name', c.display_name,
        'email_domains', c.email_domains, 'allowed_redirect_urls', c.allowed_redirect_urls,
        'metadata_url', c.metadata_url, 'issuer_url', c.issuer_url, 'client_id', c.client_id,
        'status', c.status, 'is_enforced', c.is_enforced)
      FROM public.organization_sso_configurations c WHERE c.organization_id = _organization_id
    ),
    'api_keys', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', k.name, 'key_prefix', k.key_prefix, 'scopes', k.scopes,
        'status', k.status, 'rate_limit_per_hour', k.rate_limit_per_hour,
        'created_at', k.created_at, 'last_used_at', k.last_used_at, 'revoked_at', k.revoked_at
      )), '[]'::jsonb)
      FROM public.organization_api_keys k WHERE k.organization_id = _organization_id
    ),
    'webhooks', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', w.name, 'target_url', w.target_url, 'event_types', w.event_types,
        'status', w.status, 'last_delivery_at', w.last_delivery_at,
        'last_delivery_status', w.last_delivery_status
      )), '[]'::jsonb)
      FROM public.organization_webhooks w WHERE w.organization_id = _organization_id
    ),
    'audit_logs', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action', a.action, 'entity_type', a.entity_type, 'entity_label', a.entity_label,
        'details', a.details, 'created_at', a.created_at
      ) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM public.audit_logs a WHERE a.organization_id = _organization_id
    ),
    'api_request_logs', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'method', l.method, 'path', l.path, 'status_code', l.status_code,
        'outcome', l.outcome, 'created_at', l.created_at
      ) ORDER BY l.created_at DESC), '[]'::jsonb)
      FROM public.api_request_logs l WHERE l.organization_id = _organization_id
    ),
    'notice', 'Secrets, API key hashes and webhook signing secrets are deliberately excluded. Member exam answers belong to each member and are available through their own personal export.'
  ) INTO _payload;

  INSERT INTO public.data_export_requests (scope, user_id, organization_id, payload, byte_size, expires_at)
  VALUES ('organization', _uid, _organization_id, _payload, length(_payload::text), now() + make_interval(hours => _ttl))
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (_uid, 'privacy.organization_export_created', 'data_export_request', _row.id,
          'Organisation data export', jsonb_build_object('byte_size', _row.byte_size), _organization_id);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.export_organization_data(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.export_organization_data(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_export_download(_export_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.data_export_requests;
BEGIN
  SELECT * INTO _row FROM public.data_export_requests WHERE id = _export_id;
  IF _row IS NULL THEN RAISE EXCEPTION 'Export not found'; END IF;
  IF NOT (_row.user_id = auth.uid()
          OR (_row.organization_id IS NOT NULL AND public.is_org_admin(_row.organization_id, auth.uid()))) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.data_export_requests
     SET download_count = download_count + 1
   WHERE id = _export_id;
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'privacy.export_downloaded', 'data_export_request', _export_id,
          _row.scope || ' export', '{}'::jsonb, _row.organization_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_export_download(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_export_download(uuid) TO authenticated;

-- Account deletion workflow -------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_account_deletion(_reason text DEFAULT NULL)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _grace integer;
  _row public.account_deletion_requests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_deletion_requests
              WHERE user_id = _uid AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'A deletion request is already open for this account';
  END IF;

  SELECT COALESCE(deletion_grace_days, 30) INTO _grace
    FROM public.retention_policies WHERE organization_id IS NULL;

  INSERT INTO public.account_deletion_requests (user_id, reason, scheduled_for)
  VALUES (_uid, NULLIF(btrim(_reason), ''), now() + make_interval(days => COALESCE(_grace, 30)))
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (_uid, 'privacy.account_deletion_requested', 'account_deletion_request', _row.id,
          'Account deletion requested', jsonb_build_object('scheduled_for', _row.scheduled_for));

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.account_deletion_requests;
BEGIN
  UPDATE public.account_deletion_requests
     SET status = 'cancelled', cancelled_at = now()
   WHERE user_id = auth.uid() AND status IN ('pending', 'approved')
  RETURNING * INTO _row;
  IF _row IS NULL THEN RAISE EXCEPTION 'No open deletion request to cancel'; END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), 'privacy.account_deletion_cancelled', 'account_deletion_request', _row.id,
          'Account deletion cancelled', '{}'::jsonb);
  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_account_deletion(_request_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS public.account_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.account_deletion_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a platform administrator may decide deletion requests';
  END IF;
  IF _decision NOT IN ('approved', 'rejected', 'completed') THEN
    RAISE EXCEPTION 'Unsupported decision';
  END IF;

  UPDATE public.account_deletion_requests
     SET status = _decision,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = NULLIF(btrim(_note), ''),
         completed_at = CASE WHEN _decision = 'completed' THEN now() ELSE completed_at END
   WHERE id = _request_id AND status IN ('pending', 'approved')
  RETURNING * INTO _row;
  IF _row IS NULL THEN RAISE EXCEPTION 'Deletion request is not open'; END IF;

  -- Completion anonymises the profile. Financial records are retained because
  -- Indian tax and consumer-protection rules require them; they are unlinked
  -- from identifying profile fields instead of being destroyed.
  IF _decision = 'completed' THEN
    UPDATE public.profiles
       SET email = NULL, full_name = 'Deleted account'
     WHERE id = _row.user_id;
    UPDATE public.organization_members
       SET status = 'removed', removed_at = now()
     WHERE user_id = _row.user_id AND status <> 'removed';
    DELETE FROM public.ai_interview_sessions WHERE user_id = _row.user_id;
    UPDATE public.entitlements
       SET status = 'revoked', revoked_at = now(), revoke_reason = 'account deleted'
     WHERE user_id = _row.user_id AND status = 'active';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), 'privacy.account_deletion_' || _decision, 'account_deletion_request', _row.id,
          'Account deletion ' || _decision, jsonb_build_object('note', _row.decision_note));

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_account_deletion(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_account_deletion(uuid, text, text) TO authenticated;

-- Organisation deletion workflow --------------------------------------------

CREATE OR REPLACE FUNCTION public.request_organization_deletion(_organization_id uuid, _reason text DEFAULT NULL)
RETURNS public.organization_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.organization_deletion_requests;
  _grace integer;
BEGIN
  IF NOT (public.has_org_role(_organization_id, auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the organisation owner may request closure';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_deletion_requests
              WHERE organization_id = _organization_id AND status IN ('pending', 'approved')) THEN
    RAISE EXCEPTION 'A closure request is already open for this organisation';
  END IF;

  SELECT COALESCE(
    (SELECT deletion_grace_days FROM public.retention_policies WHERE organization_id = _organization_id),
    (SELECT deletion_grace_days FROM public.retention_policies WHERE organization_id IS NULL),
    30) INTO _grace;

  INSERT INTO public.organization_deletion_requests (organization_id, requested_by, reason, scheduled_for)
  VALUES (_organization_id, auth.uid(), NULLIF(btrim(_reason), ''), now() + make_interval(days => _grace))
  RETURNING * INTO _row;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'privacy.organization_deletion_requested', 'organization_deletion_request', _row.id,
          'Organisation closure requested', jsonb_build_object('scheduled_for', _row.scheduled_for), _organization_id);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.request_organization_deletion(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.request_organization_deletion(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_organization_deletion(_organization_id uuid)
RETURNS public.organization_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.organization_deletion_requests;
BEGIN
  IF NOT (public.has_org_role(_organization_id, auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the organisation owner may cancel closure';
  END IF;
  UPDATE public.organization_deletion_requests
     SET status = 'cancelled', cancelled_at = now()
   WHERE organization_id = _organization_id AND status IN ('pending', 'approved')
  RETURNING * INTO _row;
  IF _row IS NULL THEN RAISE EXCEPTION 'No open closure request'; END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'privacy.organization_deletion_cancelled', 'organization_deletion_request', _row.id,
          'Organisation closure cancelled', '{}'::jsonb, _organization_id);
  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_organization_deletion(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_organization_deletion(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_organization_deletion(_request_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS public.organization_deletion_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.organization_deletion_requests;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a platform administrator may decide closure requests';
  END IF;
  IF _decision NOT IN ('approved', 'rejected', 'completed') THEN
    RAISE EXCEPTION 'Unsupported decision';
  END IF;

  UPDATE public.organization_deletion_requests
     SET status = _decision, decided_by = auth.uid(), decided_at = now(),
         decision_note = NULLIF(btrim(_note), ''),
         completed_at = CASE WHEN _decision = 'completed' THEN now() ELSE completed_at END
   WHERE id = _request_id AND status IN ('pending', 'approved')
  RETURNING * INTO _row;
  IF _row IS NULL THEN RAISE EXCEPTION 'Closure request is not open'; END IF;

  -- Closure suspends the tenant and revokes every access path. Individual
  -- members keep their own accounts, attempts and results.
  IF _decision = 'completed' THEN
    UPDATE public.organizations SET status = 'closed' WHERE id = _row.organization_id;
    UPDATE public.organization_members SET status = 'removed', removed_at = now()
      WHERE organization_id = _row.organization_id AND status <> 'removed';
    UPDATE public.organization_entitlements
       SET status = 'revoked', revoked_at = now(), revoke_reason = 'organisation closed'
     WHERE organization_id = _row.organization_id AND status = 'active';
    UPDATE public.organization_api_keys
       SET status = 'revoked', revoked_at = now(), revoked_by = auth.uid()
     WHERE organization_id = _row.organization_id AND status = 'active';
    UPDATE public.organization_webhooks SET status = 'disabled'
     WHERE organization_id = _row.organization_id AND status = 'active';
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'privacy.organization_deletion_' || _decision, 'organization_deletion_request',
          _row.id, 'Organisation closure ' || _decision,
          jsonb_build_object('note', _row.decision_note), _row.organization_id);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_organization_deletion(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.decide_organization_deletion(uuid, text, text) TO authenticated;

-- Retention -----------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.upsert_retention_policy(
  _organization_id uuid,
  _ai_log_retention_days integer,
  _api_log_retention_days integer,
  _export_ttl_hours integer,
  _deletion_grace_days integer,
  _attempt_retention_days integer DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS public.retention_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.retention_policies;
BEGIN
  IF _organization_id IS NULL THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only a platform administrator may change the platform retention policy';
    END IF;
    UPDATE public.retention_policies
       SET ai_log_retention_days = _ai_log_retention_days,
           api_log_retention_days = _api_log_retention_days,
           export_ttl_hours = _export_ttl_hours,
           deletion_grace_days = _deletion_grace_days,
           attempt_retention_days = _attempt_retention_days,
           notes = _notes,
           updated_by = auth.uid()
     WHERE organization_id IS NULL
    RETURNING * INTO _row;
  ELSE
    IF NOT (public.is_org_admin(_organization_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'Only an organisation administrator may change this retention policy';
    END IF;
    INSERT INTO public.retention_policies (organization_id, ai_log_retention_days, api_log_retention_days,
      export_ttl_hours, deletion_grace_days, attempt_retention_days, notes, updated_by)
    VALUES (_organization_id, _ai_log_retention_days, _api_log_retention_days, _export_ttl_hours,
      _deletion_grace_days, _attempt_retention_days, _notes, auth.uid())
    ON CONFLICT (organization_id) WHERE organization_id IS NOT NULL DO UPDATE
      SET ai_log_retention_days = EXCLUDED.ai_log_retention_days,
          api_log_retention_days = EXCLUDED.api_log_retention_days,
          export_ttl_hours = EXCLUDED.export_ttl_hours,
          deletion_grace_days = EXCLUDED.deletion_grace_days,
          attempt_retention_days = EXCLUDED.attempt_retention_days,
          notes = EXCLUDED.notes,
          updated_by = auth.uid()
    RETURNING * INTO _row;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (auth.uid(), 'privacy.retention_policy_updated', 'retention_policy', _row.id,
          COALESCE('Organisation retention policy', 'Platform retention policy'),
          to_jsonb(_row) - 'id', _organization_id);

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_retention_policy(uuid, integer, integer, integer, integer, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.upsert_retention_policy(uuid, integer, integer, integer, integer, integer, text) TO authenticated;

-- Scheduled purge. Applies the platform policy to logs and expired exports.
CREATE OR REPLACE FUNCTION public.apply_retention_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _policy public.retention_policies;
  _expired integer := 0;
  _ai integer := 0;
  _api integer := 0;
BEGIN
  SELECT * INTO _policy FROM public.retention_policies WHERE organization_id IS NULL;

  UPDATE public.data_export_requests
     SET status = 'expired', payload = '{}'::jsonb
   WHERE status = 'ready' AND expires_at < now();
  GET DIAGNOSTICS _expired = ROW_COUNT;

  DELETE FROM public.ai_usage_logs
   WHERE created_at < now() - make_interval(days => COALESCE(_policy.ai_log_retention_days, 180));
  GET DIAGNOSTICS _ai = ROW_COUNT;

  DELETE FROM public.api_request_logs
   WHERE created_at < now() - make_interval(days => COALESCE(_policy.api_log_retention_days, 90));
  GET DIAGNOSTICS _api = ROW_COUNT;

  RETURN jsonb_build_object('exports_expired', _expired, 'ai_logs_deleted', _ai, 'api_logs_deleted', _api);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_retention_policies() FROM public, anon, authenticated;

SELECT cron.schedule('askmeexam-apply-retention', '30 2 * * *', $$SELECT public.apply_retention_policies();$$);