-- 1. Application settings: enforced singleton row -----------------------------
CREATE TABLE IF NOT EXISTS public.application_settings (
  id text NOT NULL PRIMARY KEY DEFAULT 'global',
  application_name text NOT NULL DEFAULT 'AskMeExam',
  tagline text NOT NULL DEFAULT 'Practice with Confidence.',
  support_email text NOT NULL DEFAULT 'support@askmeexam.com',
  footer_disclaimer text NOT NULL DEFAULT '',
  application_version text NOT NULL DEFAULT '0.1.0',
  default_passing_scaled_score integer NOT NULL DEFAULT 700,
  default_exam_duration_minutes integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT application_settings_singleton CHECK (id = 'global'),
  CONSTRAINT application_settings_name_len CHECK (char_length(btrim(application_name)) BETWEEN 2 AND 80),
  CONSTRAINT application_settings_tagline_len CHECK (char_length(btrim(tagline)) BETWEEN 2 AND 160),
  CONSTRAINT application_settings_email_format CHECK (support_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT application_settings_disclaimer_len CHECK (char_length(footer_disclaimer) BETWEEN 0 AND 600),
  CONSTRAINT application_settings_version_format CHECK (application_version ~ '^[0-9]+\.[0-9]+\.[0-9]+([-.a-zA-Z0-9]*)$'),
  CONSTRAINT application_settings_score_range CHECK (default_passing_scaled_score BETWEEN 1 AND 1000),
  CONSTRAINT application_settings_duration_range CHECK (default_exam_duration_minutes BETWEEN 1 AND 600)
);

GRANT SELECT ON public.application_settings TO anon;
GRANT SELECT, UPDATE ON public.application_settings TO authenticated;
GRANT ALL ON public.application_settings TO service_role;

ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS application_settings_select_public ON public.application_settings;
CREATE POLICY application_settings_select_public
  ON public.application_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS application_settings_update_admin ON public.application_settings;
CREATE POLICY application_settings_update_admin
  ON public.application_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
-- No INSERT/DELETE policy: the singleton row cannot be added or removed via the API.

-- 2. Seed / keep the singleton row in sync with current branding --------------
INSERT INTO public.application_settings (id, application_name, tagline, support_email, footer_disclaimer, application_version, default_passing_scaled_score, default_exam_duration_minutes)
VALUES (
  'global',
  'AskMeExam',
  'Practice with Confidence.',
  'support@askmeexam.com',
  'AskMeExam is an independent certification practice platform and is not affiliated with or endorsed by Microsoft.',
  '0.1.0',
  700,
  60
)
ON CONFLICT (id) DO NOTHING;

-- 3. updated_at / updated_by + audit trail on settings changes ----------------
CREATE OR REPLACE FUNCTION public.application_settings_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed jsonb := '{}'::jsonb;
BEGIN
  NEW.id := 'global';
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();

  IF NEW.application_name IS DISTINCT FROM OLD.application_name THEN
    changed := changed || jsonb_build_object('application_name', NEW.application_name);
  END IF;
  IF NEW.tagline IS DISTINCT FROM OLD.tagline THEN
    changed := changed || jsonb_build_object('tagline', NEW.tagline);
  END IF;
  IF NEW.support_email IS DISTINCT FROM OLD.support_email THEN
    changed := changed || jsonb_build_object('support_email', NEW.support_email);
  END IF;
  IF NEW.footer_disclaimer IS DISTINCT FROM OLD.footer_disclaimer THEN
    changed := changed || jsonb_build_object('footer_disclaimer_changed', true);
  END IF;
  IF NEW.application_version IS DISTINCT FROM OLD.application_version THEN
    changed := changed || jsonb_build_object('application_version', NEW.application_version, 'previous_version', OLD.application_version);
  END IF;
  IF NEW.default_passing_scaled_score IS DISTINCT FROM OLD.default_passing_scaled_score THEN
    changed := changed || jsonb_build_object('default_passing_scaled_score', NEW.default_passing_scaled_score);
  END IF;
  IF NEW.default_exam_duration_minutes IS DISTINCT FROM OLD.default_exam_duration_minutes THEN
    changed := changed || jsonb_build_object('default_exam_duration_minutes', NEW.default_exam_duration_minutes);
  END IF;

  IF changed <> '{}'::jsonb THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
    VALUES (auth.uid(), 'settings.update', 'application_settings', NULL, 'Application settings', changed);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_settings_audit_trg ON public.application_settings;
CREATE TRIGGER application_settings_audit_trg
  BEFORE UPDATE ON public.application_settings
  FOR EACH ROW EXECUTE FUNCTION public.application_settings_audit();

-- 4. Owner-only first-admin assignment ----------------------------------------
CREATE OR REPLACE FUNCTION public.grant_admin_role(_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _inserted boolean := false;
BEGIN
  IF _email IS NULL OR btrim(_email) = '' THEN
    RAISE EXCEPTION 'An email address is required';
  END IF;

  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = lower(btrim(_email)) LIMIT 1;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No registered user found for that email address';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
    VALUES (auth.uid(), 'role.admin_granted', 'user_role', _user_id, lower(btrim(_email)),
            jsonb_build_object('role', 'admin', 'source', 'seed_admin_procedure'));
    RETURN 'admin role granted';
  END IF;

  RETURN 'admin role already present (no change)';
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_admin_role(_email text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _removed integer := 0;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE lower(email) = lower(btrim(coalesce(_email, ''))) LIMIT 1;
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No registered user found for that email address';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role;
  GET DIAGNOSTICS _removed = ROW_COUNT;

  IF _removed > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
    VALUES (auth.uid(), 'role.admin_revoked', 'user_role', _user_id, lower(btrim(_email)),
            jsonb_build_object('role', 'admin', 'source', 'seed_admin_procedure'));
    RETURN 'admin role removed';
  END IF;

  RETURN 'user did not have the admin role (no change)';
END;
$$;

-- Only the database owner / service role may execute these routines.
REVOKE ALL ON FUNCTION public.grant_admin_role(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_admin_role(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_role(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_admin_role(text) TO service_role;