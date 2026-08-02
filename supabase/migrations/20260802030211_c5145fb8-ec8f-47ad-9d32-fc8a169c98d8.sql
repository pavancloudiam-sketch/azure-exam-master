ALTER TABLE public.certifications
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'Microsoft',
  ADD COLUMN IF NOT EXISTS exam_code text,
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS effective_at date,
  ADD COLUMN IF NOT EXISTS retired_at date,
  ADD COLUMN IF NOT EXISTS lifecycle_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS allow_new_attempts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS family_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS supersedes_id uuid REFERENCES public.certifications(id);

ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_lifecycle_status_check;
ALTER TABLE public.certifications
  ADD CONSTRAINT certifications_lifecycle_status_check
  CHECK (lifecycle_status IN ('draft', 'active', 'retired'));

UPDATE public.certifications SET lifecycle_status = 'active' WHERE is_active AND lifecycle_status = 'draft';

ALTER TABLE public.certifications DROP CONSTRAINT IF EXISTS certifications_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS certifications_family_version_key
  ON public.certifications (family_id, version);
CREATE UNIQUE INDEX IF NOT EXISTS certifications_code_version_key
  ON public.certifications (code, version);
CREATE INDEX IF NOT EXISTS certifications_family_idx ON public.certifications (family_id);

CREATE OR REPLACE FUNCTION public.create_certification_version(
  _source_id uuid,
  _version text,
  _exam_code text DEFAULT NULL,
  _effective_at date DEFAULT NULL,
  _clone_taxonomy boolean DEFAULT true
)
RETURNS public.certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE src public.certifications; nv public.certifications; d record; new_domain_id uuid; cloned integer := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;
  IF coalesce(btrim(_version), '') = '' THEN RAISE EXCEPTION 'A version label is required'; END IF;

  SELECT * INTO src FROM public.certifications WHERE id = _source_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Certification not found'; END IF;

  IF EXISTS (SELECT 1 FROM public.certifications
             WHERE family_id = src.family_id AND version = btrim(_version)) THEN
    RAISE EXCEPTION 'That version already exists for this certification';
  END IF;

  INSERT INTO public.certifications
    (code, name, description, provider, exam_code, version, effective_at,
     lifecycle_status, allow_new_attempts, is_active, family_id, supersedes_id)
  VALUES (src.code, src.name, src.description, src.provider,
          coalesce(NULLIF(btrim(coalesce(_exam_code, '')), ''), src.exam_code),
          btrim(_version), _effective_at, 'draft', true, false, src.family_id, src.id)
  RETURNING * INTO nv;

  IF _clone_taxonomy THEN
    FOR d IN SELECT * FROM public.domains WHERE certification_id = src.id ORDER BY sort_order, name LOOP
      INSERT INTO public.domains (certification_id, name, weight_percent, sort_order, is_active)
      VALUES (nv.id, d.name, d.weight_percent, d.sort_order, d.is_active)
      RETURNING id INTO new_domain_id;
      cloned := cloned + 1;

      INSERT INTO public.topics (domain_id, name, sort_order, is_active)
      SELECT new_domain_id, t.name, t.sort_order, t.is_active
      FROM public.topics t WHERE t.domain_id = d.id;
    END LOOP;
  END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), 'certification.version_created', 'certification', nv.id, nv.name,
          jsonb_build_object('version', nv.version, 'source_id', src.id,
                             'source_version', src.version,
                             'cloned_domains', cloned, 'clone_taxonomy', _clone_taxonomy));

  RETURN nv;
END;
$$;

CREATE OR REPLACE FUNCTION public.retire_certification_version(
  _certification_id uuid,
  _retired_at date DEFAULT NULL,
  _allow_new_attempts boolean DEFAULT false
)
RETURNS public.certifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE c public.certifications;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admin role required'; END IF;

  UPDATE public.certifications
  SET lifecycle_status = 'retired',
      retired_at = coalesce(_retired_at, current_date),
      allow_new_attempts = _allow_new_attempts,
      is_active = _allow_new_attempts
  WHERE id = _certification_id
  RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Certification not found'; END IF;

  INSERT INTO public.audit_logs (actor_id, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), 'certification.version_retired', 'certification', c.id, c.name,
          jsonb_build_object('version', c.version, 'retired_at', c.retired_at,
                             'allow_new_attempts', c.allow_new_attempts));

  RETURN c;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_attempt(_exam_id uuid, _mode text)
 RETURNS attempts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  a public.attempts;
  e public.exams;
  c public.certifications;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _mode NOT IN ('timed', 'practice') THEN RAISE EXCEPTION 'Invalid mode'; END IF;

  SELECT * INTO e FROM public.exams WHERE id = _exam_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Exam not found'; END IF;
  IF NOT e.is_published AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Exam is not available';
  END IF;

  SELECT * INTO c FROM public.certifications WHERE id = e.certification_id;
  IF c.lifecycle_status = 'retired' AND NOT c.allow_new_attempts THEN
    RAISE EXCEPTION 'This certification version is retired and is not accepting new attempts';
  END IF;

  IF _mode = 'timed' AND e.time_limit_minutes IS NULL THEN
    RAISE EXCEPTION 'This exam has no time limit configured';
  END IF;

  SELECT * INTO a FROM public.attempts
  WHERE user_id = uid AND exam_id = _exam_id AND status = 'in_progress'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY started_at DESC LIMIT 1;
  IF FOUND THEN RETURN a; END IF;

  INSERT INTO public.attempts (user_id, exam_id, mode, started_at, expires_at)
  VALUES (
    uid, _exam_id, _mode, now(),
    CASE WHEN _mode = 'timed'
      THEN now() + make_interval(mins => e.time_limit_minutes) END
  )
  RETURNING * INTO a;
  RETURN a;
END;
$function$;