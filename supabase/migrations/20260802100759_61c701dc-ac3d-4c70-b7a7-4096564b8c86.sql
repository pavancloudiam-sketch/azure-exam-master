
CREATE TABLE IF NOT EXISTS public.retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed')),
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.retention_runs TO authenticated;
GRANT ALL ON public.retention_runs TO service_role;

ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins read retention runs" ON public.retention_runs;
CREATE POLICY "Platform admins read retention runs"
  ON public.retention_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_retention_runs_started ON public.retention_runs (started_at DESC);

-- ---------------------------------------------------------------- helpers

CREATE OR REPLACE FUNCTION public.log_retention_action(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _entity_label text,
  _details jsonb DEFAULT '{}'::jsonb,
  _organization_id uuid DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details, organization_id)
  VALUES (NULL, _action, _entity_type, _entity_id, _entity_label, COALESCE(_details, '{}'::jsonb), _organization_id);
$$;

REVOKE ALL ON FUNCTION public.log_retention_action(text, text, uuid, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;

-- Purges one user's personal data. Raises on failure so the caller can roll
-- back just this request.
CREATE OR REPLACE FUNCTION public.execute_account_deletion(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.account_deletion_requests;
  _attempts integer := 0;
  _entitlements integer := 0;
  _memberships integer := 0;
BEGIN
  SELECT * INTO _req
    FROM public.account_deletion_requests
   WHERE id = _request_id
   FOR UPDATE;

  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'deletion request % not found', _request_id;
  END IF;
  IF _req.status <> 'approved' OR _req.scheduled_for > now() THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  DELETE FROM public.attempts WHERE user_id = _req.user_id;
  GET DIAGNOSTICS _attempts = ROW_COUNT;

  DELETE FROM public.ai_interview_sessions WHERE user_id = _req.user_id;
  DELETE FROM public.ai_usage_logs WHERE user_id = _req.user_id;
  DELETE FROM public.data_export_requests WHERE user_id = _req.user_id;
  DELETE FROM public.email_notifications WHERE user_id = _req.user_id AND status = 'queued';

  UPDATE public.entitlements
     SET status = 'revoked', revoked_at = now(), revoke_reason = 'account_deleted'
   WHERE user_id = _req.user_id AND status = 'active';
  GET DIAGNOSTICS _entitlements = ROW_COUNT;

  DELETE FROM public.organization_roles WHERE user_id = _req.user_id;
  UPDATE public.organization_members
     SET status = 'removed', removed_at = now()
   WHERE user_id = _req.user_id AND status <> 'removed';
  GET DIAGNOSTICS _memberships = ROW_COUNT;

  UPDATE public.profiles
     SET email = NULL, full_name = 'Deleted account'
   WHERE id = _req.user_id;

  UPDATE public.account_deletion_requests
     SET status = 'completed', completed_at = now()
   WHERE id = _req.id;

  PERFORM public.log_retention_action(
    'retention.account_deleted', 'account_deletion_request', _req.id, 'Account deletion executed',
    jsonb_build_object('user_id', _req.user_id, 'attempts_deleted', _attempts,
                       'entitlements_revoked', _entitlements, 'memberships_removed', _memberships)
  );

  RETURN jsonb_build_object('attempts_deleted', _attempts,
                            'entitlements_revoked', _entitlements,
                            'memberships_removed', _memberships);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_account_deletion(uuid) FROM PUBLIC, anon, authenticated;

-- Purges one tenant's data. The (suspended) organisation shell row is kept so
-- the completed request and audit trail survive.
CREATE OR REPLACE FUNCTION public.execute_organization_deletion(_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.organization_deletion_requests;
  _members integer := 0;
  _entitlements integer := 0;
BEGIN
  SELECT * INTO _req
    FROM public.organization_deletion_requests
   WHERE id = _request_id
   FOR UPDATE;

  IF _req.id IS NULL THEN
    RAISE EXCEPTION 'organisation deletion request % not found', _request_id;
  END IF;
  IF _req.status <> 'approved' OR _req.scheduled_for > now() THEN
    RETURN jsonb_build_object('skipped', true);
  END IF;

  UPDATE public.organization_entitlements
     SET revoked_at = now()
   WHERE organization_id = _req.organization_id AND revoked_at IS NULL;
  GET DIAGNOSTICS _entitlements = ROW_COUNT;

  DELETE FROM public.organization_roles WHERE organization_id = _req.organization_id;

  UPDATE public.organization_members
     SET status = 'removed', removed_at = now()
   WHERE organization_id = _req.organization_id AND status <> 'removed';
  GET DIAGNOSTICS _members = ROW_COUNT;

  DELETE FROM public.organization_branding WHERE organization_id = _req.organization_id;
  DELETE FROM public.organization_settings WHERE organization_id = _req.organization_id;
  DELETE FROM public.organization_sso_configurations WHERE organization_id = _req.organization_id;
  DELETE FROM public.scim_provisioning_tokens WHERE organization_id = _req.organization_id;
  DELETE FROM public.organization_api_keys WHERE organization_id = _req.organization_id;
  DELETE FROM public.organization_webhooks WHERE organization_id = _req.organization_id;
  DELETE FROM public.data_export_requests WHERE organization_id = _req.organization_id;

  UPDATE public.organizations
     SET status = 'suspended'
   WHERE id = _req.organization_id;

  UPDATE public.organization_deletion_requests
     SET status = 'completed', completed_at = now()
   WHERE id = _req.id;

  PERFORM public.log_retention_action(
    'retention.organization_deleted', 'organization_deletion_request', _req.id,
    'Organisation deletion executed',
    jsonb_build_object('organization_id', _req.organization_id,
                       'members_removed', _members,
                       'entitlements_revoked', _entitlements),
    NULL
  );

  RETURN jsonb_build_object('members_removed', _members, 'entitlements_revoked', _entitlements);
END;
$$;

REVOKE ALL ON FUNCTION public.execute_organization_deletion(uuid) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------- extended nightly routine

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
  _accounts integer := 0;
  _account_failures integer := 0;
  _orgs integer := 0;
  _org_failures integer := 0;
  _attempts_deleted integer := 0;
  _seat_invites_withdrawn integer := 0;
  _seat_over_limit integer := 0;
  _row record;
  _n integer;
  _errors jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO _policy FROM public.retention_policies WHERE organization_id IS NULL;

  -- 1. exports ------------------------------------------------------------
  BEGIN
    UPDATE public.data_export_requests
       SET status = 'expired', payload = '{}'::jsonb
     WHERE status = 'ready' AND expires_at < now();
    GET DIAGNOSTICS _expired = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    _errors := _errors || jsonb_build_object('step', 'exports', 'error', SQLERRM);
  END;

  -- 2. log retention ------------------------------------------------------
  BEGIN
    DELETE FROM public.ai_usage_logs
     WHERE created_at < now() - make_interval(days => COALESCE(_policy.ai_log_retention_days, 180));
    GET DIAGNOSTICS _ai = ROW_COUNT;

    DELETE FROM public.api_request_logs
     WHERE created_at < now() - make_interval(days => COALESCE(_policy.api_log_retention_days, 90));
    GET DIAGNOSTICS _api = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    _errors := _errors || jsonb_build_object('step', 'logs', 'error', SQLERRM);
  END;

  -- 3. account deletions past the grace period ----------------------------
  FOR _row IN
    SELECT id FROM public.account_deletion_requests
     WHERE status = 'approved' AND scheduled_for <= now()
     ORDER BY scheduled_for
  LOOP
    BEGIN
      PERFORM public.execute_account_deletion(_row.id);
      _accounts := _accounts + 1;
    EXCEPTION WHEN OTHERS THEN
      -- this request alone is rolled back; the run continues
      _account_failures := _account_failures + 1;
      _errors := _errors || jsonb_build_object('step', 'account_deletion', 'request_id', _row.id, 'error', SQLERRM);
    END;
  END LOOP;

  -- 4. organisation deletions past the grace period -----------------------
  FOR _row IN
    SELECT id FROM public.organization_deletion_requests
     WHERE status = 'approved' AND scheduled_for <= now()
     ORDER BY scheduled_for
  LOOP
    BEGIN
      PERFORM public.execute_organization_deletion(_row.id);
      _orgs := _orgs + 1;
    EXCEPTION WHEN OTHERS THEN
      _org_failures := _org_failures + 1;
      _errors := _errors || jsonb_build_object('step', 'organization_deletion', 'request_id', _row.id, 'error', SQLERRM);
    END;
  END LOOP;

  -- 5. attempt retention (tenant policy first, platform default otherwise) --
  BEGIN
    FOR _row IN
      SELECT rp.organization_id, rp.attempt_retention_days
        FROM public.retention_policies rp
       WHERE rp.organization_id IS NOT NULL AND rp.attempt_retention_days IS NOT NULL
    LOOP
      DELETE FROM public.attempts a
       WHERE a.started_at < now() - make_interval(days => _row.attempt_retention_days)
         AND EXISTS (
           SELECT 1 FROM public.organization_members m
            WHERE m.user_id = a.user_id
              AND m.organization_id = _row.organization_id
              AND m.status = 'active');
      GET DIAGNOSTICS _n = ROW_COUNT;
      _attempts_deleted := _attempts_deleted + _n;
      IF _n > 0 THEN
        PERFORM public.log_retention_action(
          'retention.attempts_purged', 'organization', _row.organization_id, 'Attempt retention applied',
          jsonb_build_object('deleted', _n, 'retention_days', _row.attempt_retention_days),
          _row.organization_id);
      END IF;
    END LOOP;

    IF _policy.attempt_retention_days IS NOT NULL THEN
      DELETE FROM public.attempts a
       WHERE a.started_at < now() - make_interval(days => _policy.attempt_retention_days)
         AND NOT EXISTS (
           SELECT 1
             FROM public.organization_members m
             JOIN public.retention_policies rp
               ON rp.organization_id = m.organization_id
              AND rp.attempt_retention_days IS NOT NULL
            WHERE m.user_id = a.user_id AND m.status = 'active');
      GET DIAGNOSTICS _n = ROW_COUNT;
      _attempts_deleted := _attempts_deleted + _n;
      IF _n > 0 THEN
        PERFORM public.log_retention_action(
          'retention.attempts_purged', 'retention_policy', NULL, 'Attempt retention applied (platform default)',
          jsonb_build_object('deleted', _n, 'retention_days', _policy.attempt_retention_days));
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _errors := _errors || jsonb_build_object('step', 'attempt_retention', 'error', SQLERRM);
  END;

  -- 6. seat limits: withdraw surplus invitations, never active members -----
  BEGIN
    FOR _row IN
      SELECT s.organization_id,
             s.seat_limit,
             (SELECT count(*) FROM public.organization_members m
               WHERE m.organization_id = s.organization_id AND m.status = 'active') AS active_count
        FROM public.organization_settings s
       WHERE s.seat_limit IS NOT NULL
    LOOP
      IF _row.active_count >= _row.seat_limit THEN
        UPDATE public.organization_members m
           SET status = 'removed', removed_at = now()
         WHERE m.organization_id = _row.organization_id
           AND m.status = 'invited';
        GET DIAGNOSTICS _n = ROW_COUNT;
      ELSE
        UPDATE public.organization_members m
           SET status = 'removed', removed_at = now()
         WHERE m.id IN (
           SELECT id FROM public.organization_members
            WHERE organization_id = _row.organization_id AND status = 'invited'
            ORDER BY invited_at DESC
            OFFSET GREATEST(_row.seat_limit - _row.active_count, 0)
         );
        GET DIAGNOSTICS _n = ROW_COUNT;
      END IF;

      _seat_invites_withdrawn := _seat_invites_withdrawn + _n;
      IF _row.active_count > _row.seat_limit THEN
        _seat_over_limit := _seat_over_limit + 1;
      END IF;

      IF _n > 0 OR _row.active_count > _row.seat_limit THEN
        PERFORM public.log_retention_action(
          'retention.seat_limit_enforced', 'organization', _row.organization_id, 'Seat limit enforced',
          jsonb_build_object('seat_limit', _row.seat_limit,
                             'active_members', _row.active_count,
                             'invitations_withdrawn', _n,
                             'over_limit', _row.active_count > _row.seat_limit),
          _row.organization_id);
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    _errors := _errors || jsonb_build_object('step', 'seat_limits', 'error', SQLERRM);
  END;

  RETURN jsonb_build_object(
    'exports_expired', _expired,
    'ai_logs_deleted', _ai,
    'api_logs_deleted', _api,
    'accounts_deleted', _accounts,
    'account_failures', _account_failures,
    'organizations_deleted', _orgs,
    'organization_failures', _org_failures,
    'attempts_deleted', _attempts_deleted,
    'seat_invitations_withdrawn', _seat_invites_withdrawn,
    'organizations_over_seat_limit', _seat_over_limit,
    'errors', _errors
  );
END;
$$;

-- Runs the nightly routine at most once per 20 hours, guarded by an advisory
-- lock so overlapping worker ticks can never run it twice.
CREATE OR REPLACE FUNCTION public.run_nightly_retention(_force boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run_id uuid;
  _report jsonb;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('askmeexam.nightly_retention')) THEN
    RETURN jsonb_build_object('status', 'busy');
  END IF;

  IF NOT _force AND EXISTS (
    SELECT 1 FROM public.retention_runs
     WHERE started_at > now() - interval '20 hours'
       AND status <> 'failed'
  ) THEN
    RETURN jsonb_build_object('status', 'skipped');
  END IF;

  INSERT INTO public.retention_runs DEFAULT VALUES RETURNING id INTO _run_id;

  BEGIN
    _report := public.apply_retention_policies();
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.retention_runs
       SET status = 'failed', finished_at = now(),
           errors = jsonb_build_array(jsonb_build_object('error', SQLERRM))
     WHERE id = _run_id;
    RETURN jsonb_build_object('status', 'failed', 'error', SQLERRM);
  END;

  UPDATE public.retention_runs
     SET status = 'completed', finished_at = now(),
         report = _report,
         errors = COALESCE(_report -> 'errors', '[]'::jsonb)
   WHERE id = _run_id;

  PERFORM public.log_retention_action(
    'retention.run_completed', 'retention_policy', _run_id, 'Nightly retention run', _report);

  RETURN jsonb_build_object('status', 'completed', 'run_id', _run_id, 'report', _report);
END;
$$;

REVOKE ALL ON FUNCTION public.run_nightly_retention(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.run_nightly_retention(boolean) TO service_role;
